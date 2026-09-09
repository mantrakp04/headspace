import CoreAudio
import Foundation

final class SystemAudioCapture {
    enum State: String { case idle, starting, running, denied, unavailable }
    private let controlQueue = DispatchQueue(label: "headspace.audio.control")
    private let sampleQueue = DispatchQueue(label: "headspace.audio.samples", qos: .userInteractive)
    private var state = State.idle
    private var tap: AudioObjectID = 0
    private var device: AudioObjectID = 0
    private var ioProc: AudioDeviceIOProcID?
    private var timer: DispatchSourceTimer?
    private var analyzer: StereoAudioAnalyzer?
    private var lastSampleTime: TimeInterval = 0
    private var callbackCount = 0
    private var sampleCount = 0
    private var lastDiagnosticTime: TimeInterval = 0
    private let diagnosticsEnabled = CommandLine.arguments.contains("--audio-diagnostics")
    private let onFrame: (AudioAnalysisFrame) -> Void
    private let onStatus: (State, String) -> Void

    init(onFrame: @escaping (AudioAnalysisFrame) -> Void, onStatus: @escaping (State, String) -> Void) {
        self.onFrame = onFrame
        self.onStatus = onStatus
    }

    func start() {
        controlQueue.async { [self] in
            guard state != .running && state != .starting else { return }
            guard #available(macOS 14.2, *) else {
                status(.unavailable, "Audio-reactive visuals require macOS 14.2 or later.")
                return
            }
            status(.starting, "Allow Headspace to use system audio for the visualizer. Audio stays on this Mac.")
            do {
                try startTap()
                status(.running, "Listening to this Mac’s audio output.")
            } catch let error as CaptureError {
                cleanUp()
                let denied = error.code == kAudioDevicePermissionsError || error.code == 0x7065726d
                status(denied ? .denied : .unavailable, denied
                    ? "Allow Headspace in System Settings → Privacy & Security → Screen & System Audio Recording, then try again."
                    : "System audio is unavailable. Try again. (\(error.operation), \(error.code))")
            } catch {
                cleanUp()
                status(.unavailable, error.localizedDescription)
            }
        }
    }

    func stop() {
        controlQueue.async { [self] in
            cleanUp()
            status(.idle, "Audio input is off.")
        }
    }

    func shutDown() { controlQueue.sync { cleanUp() } }

    private func status(_ next: State, _ message: String) {
        state = next
        diagnostic(["state": next.rawValue, "message": message])
        DispatchQueue.main.async { [onStatus] in onStatus(next, message) }
    }

    private func diagnostic(_ values: [String: Any]) {
        guard diagnosticsEnabled, let data = try? JSONSerialization.data(withJSONObject: values, options: [.sortedKeys]) else { return }
        FileHandle.standardError.write(Data("headspace-audio ".utf8) + data + Data("\n".utf8))
    }

    private struct CaptureError: Error {
        let operation: String
        let code: OSStatus
    }

    private func check(_ code: OSStatus, _ operation: String) throws {
        if code != noErr { throw CaptureError(operation: operation, code: code) }
    }

    @available(macOS 14.2, *)
    private func startTap() throws {
        let description = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
        description.name = "Headspace visualizer"
        description.isPrivate = true
        description.muteBehavior = .unmuted
        try check(AudioHardwareCreateProcessTap(description, &tap), "audio permission")
        var address = AudioObjectPropertyAddress(mSelector: kAudioTapPropertyFormat, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var format = AudioStreamBasicDescription()
        var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        try check(AudioObjectGetPropertyData(tap, &address, 0, nil, &size, &format), "audio format")
        guard format.mFormatID == kAudioFormatLinearPCM, format.mFormatFlags & kAudioFormatFlagIsFloat != 0, format.mBitsPerChannel == 32, format.mSampleRate > 0, let analyzer = StereoAudioAnalyzer() else {
            throw CaptureError(operation: "unsupported audio format", code: kAudioDeviceUnsupportedFormatError)
        }
        self.analyzer = analyzer
        let configuration: [String: Any] = [
            kAudioAggregateDeviceNameKey: "Headspace audio analysis",
            kAudioAggregateDeviceUIDKey: "local.headspace.audio.\(UUID().uuidString)",
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceTapAutoStartKey: false,
            kAudioAggregateDeviceTapListKey: [[kAudioSubTapUIDKey: description.uuid.uuidString, kAudioSubTapDriftCompensationKey: true]],
        ]
        try check(AudioHardwareCreateAggregateDevice(configuration as CFDictionary, &device), "audio device")
        try check(AudioDeviceCreateIOProcIDWithBlock(&ioProc, device, sampleQueue) { [weak self] _, input, _, _, _ in
            guard let self else { return }
            let buffers = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: input))
            guard let first = buffers.first, first.mNumberChannels > 0 else { return }
            let frames = Int(first.mDataByteSize) / MemoryLayout<Float>.size / Int(first.mNumberChannels)
            for frame in 0..<frames {
                var left: Float = 0
                var right: Float = 0
                var channels = 0
                for buffer in buffers {
                    guard let data = buffer.mData?.assumingMemoryBound(to: Float.self), buffer.mNumberChannels > 0 else { continue }
                    let channelCount = Int(buffer.mNumberChannels)
                    guard (frame + 1) * channelCount * MemoryLayout<Float>.size <= Int(buffer.mDataByteSize) else { continue }
                    for channel in 0..<channelCount {
                        if channels == 0 { left = data[frame * channelCount + channel] }
                        if channels == 1 { right = data[frame * channelCount + channel] }
                        channels += 1
                    }
                }
                analyzer.append(left: left, right: channels > 1 ? right : left)
            }
            self.callbackCount += 1
            self.sampleCount += frames
            if frames > 0 { self.lastSampleTime = ProcessInfo.processInfo.systemUptime }
        }, "audio callback")
        try check(AudioDeviceStart(device, ioProc), "start audio")
        let timer = DispatchSource.makeTimerSource(queue: sampleQueue)
        timer.schedule(deadline: .now(), repeating: 1.0 / 40, leeway: .milliseconds(2))
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            if ProcessInfo.processInfo.systemUptime - lastSampleTime > 0.15 { analyzer.reset() }
            let frame = analyzer.frame(sampleRate: format.mSampleRate)
            let now = ProcessInfo.processInfo.systemUptime
            if diagnosticsEnabled && now - lastDiagnosticTime > 1 {
                diagnostic(["callbacks": callbackCount, "samples": sampleCount, "sampleAge": now - lastSampleTime,
                            "sampleRate": format.mSampleRate, "rms": frame.rms, "peak": frame.peak,
                            "bass": frame.bass, "mid": frame.mid, "treble": frame.treble])
                lastDiagnosticTime = now
            }
            DispatchQueue.main.async { [onFrame] in onFrame(frame) }
        }
        self.timer = timer
        timer.resume()
    }

    private func cleanUp() {
        timer?.cancel()
        timer = nil
        if let ioProc {
            AudioDeviceStop(device, ioProc)
            AudioDeviceDestroyIOProcID(device, ioProc)
            self.ioProc = nil
        }
        if device != 0 { AudioHardwareDestroyAggregateDevice(device); device = 0 }
        if #available(macOS 14.2, *), tap != 0 { AudioHardwareDestroyProcessTap(tap); tap = 0 }
        sampleQueue.sync { analyzer = nil; lastSampleTime = 0; callbackCount = 0; sampleCount = 0; lastDiagnosticTime = 0 }
        DispatchQueue.main.async { [onFrame] in onFrame(.silence) }
    }
}
