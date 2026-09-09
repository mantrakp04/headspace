import Accelerate
import Foundation

struct AudioAnalysisFrame {
    let spectrum: [Float]
    let waveform: [Float]
    let bass: Float
    let mid: Float
    let treble: Float
    let rms: Float
    let peak: Float

    static let silence = AudioAnalysisFrame(spectrum: Array(repeating: 0, count: 64), waveform: Array(repeating: 0, count: 128), bass: 0, mid: 0, treble: 0, rms: 0, peak: 0)

    var payload: [String: Any] {
        ["spectrum": spectrum, "waveform": waveform, "bass": bass, "mid": mid, "treble": treble, "rms": rms, "peak": peak]
    }
}

final class AudioAnalyzer {
    static let size = 2048
    private let transform: vDSP_DFT_Setup
    private var ring = [Float](repeating: 0, count: size)
    private var cursor = 0
    private let window: [Float]
    private var real = [Float](repeating: 0, count: size)
    private let imaginary = [Float](repeating: 0, count: size)
    private var outputReal = [Float](repeating: 0, count: size)
    private var outputImaginary = [Float](repeating: 0, count: size)

    init?() {
        guard let transform = vDSP_DFT_zop_CreateSetup(nil, vDSP_Length(Self.size), .FORWARD) else { return nil }
        self.transform = transform
        window = (0..<Self.size).map { 0.5 - 0.5 * cos(2 * .pi * Float($0) / Float(Self.size)) }
    }

    deinit { vDSP_DFT_DestroySetup(transform) }

    func reset() {
        ring = Array(repeating: 0, count: Self.size)
        cursor = 0
    }

    func append(_ sample: Float) {
        ring[cursor] = sample.isFinite ? min(1, max(-1, sample)) : 0
        cursor = (cursor + 1) % Self.size
    }

    func frame(sampleRate: Double) -> AudioAnalysisFrame {
        guard sampleRate.isFinite, sampleRate > 0 else { return .silence }
        var waveform = [Float](repeating: 0, count: 128)
        var sumSquares: Float = 0
        var peak: Float = 0
        var minimum: Float = 0
        var maximum: Float = 0
        var minimumIndex = 0
        var maximumIndex = 0
        for index in 0..<Self.size {
            let value = ring[(cursor + index) % Self.size]
            sumSquares += value * value
            peak = max(peak, abs(value))
            real[index] = value * window[index]
            if index % 32 == 0 {
                minimum = value; maximum = value
                minimumIndex = index; maximumIndex = index
            }
            if value < minimum { minimum = value; minimumIndex = index }
            if value > maximum { maximum = value; maximumIndex = index }
            if index % 32 == 31 {
                let offset = (index / 32) * 2
                waveform[offset] = minimumIndex < maximumIndex ? minimum : maximum
                waveform[offset + 1] = minimumIndex < maximumIndex ? maximum : minimum
            }
        }
        let rms = sqrt(sumSquares / Float(Self.size))
        guard peak > 0.0001 else { return .silence }
        vDSP_DFT_Execute(transform, real, imaginary, &outputReal, &outputImaginary)
        let resolution = Float(sampleRate) / Float(Self.size)
        let normalization = 4 / Float(Self.size)
        var amplitudes = [Float](repeating: 0, count: Self.size / 2)
        for index in 1..<amplitudes.count {
            amplitudes[index] = hypot(outputReal[index], outputImaginary[index]) * normalization
        }
        func energy(_ lower: Float, _ upper: Float) -> Float {
            let start = max(1, Int(ceil(lower / resolution)))
            let end = min(amplitudes.count, Int(ceil(upper / resolution)))
            guard start < end else { return 0 }
            var power: Float = 0
            for index in start..<end { power += amplitudes[index] * amplitudes[index] }
            // The Hann window spreads a tone's energy over adjacent FFT bins.
            return min(1, sqrt(power / 3))
        }
        let upperFrequency = min(16000, Float(sampleRate) * 0.49)
        let ratio = upperFrequency / 30
        let spectrum: [Float] = (0..<64).map { index in
            let lower = 30 * pow(ratio, Float(index) / 64)
            let upper = 30 * pow(ratio, Float(index + 1) / 64)
            let start = min(amplitudes.count - 1, max(1, Int(lower / resolution)))
            let end = min(amplitudes.count, max(start + 1, Int(ceil(upper / resolution))))
            let amplitude = amplitudes[start..<end].max() ?? 0
            return min(1, max(0, (20 * log10(max(0.0001, amplitude)) + 72) / 72))
        }
        return AudioAnalysisFrame(spectrum: spectrum, waveform: waveform, bass: energy(25, 180), mid: energy(180, 2500), treble: energy(2500, 16000), rms: rms, peak: peak)
    }
}

final class StereoAudioAnalyzer {
    private let left: AudioAnalyzer
    private let right: AudioAnalyzer

    init?() {
        guard let left = AudioAnalyzer(), let right = AudioAnalyzer() else { return nil }
        self.left = left
        self.right = right
    }

    func append(left: Float, right: Float) {
        self.left.append(left)
        self.right.append(right)
    }

    func reset() { left.reset(); right.reset() }

    func frame(sampleRate: Double) -> AudioAnalysisFrame {
        let left = left.frame(sampleRate: sampleRate)
        let right = right.frame(sampleRate: sampleRate)
        func powerMean(_ a: Float, _ b: Float) -> Float { sqrt((a * a + b * b) * 0.5) }
        return AudioAnalysisFrame(
            spectrum: zip(left.spectrum, right.spectrum).map { max($0, $1) },
            waveform: left.rms >= right.rms ? left.waveform : right.waveform,
            bass: powerMean(left.bass, right.bass), mid: powerMean(left.mid, right.mid),
            treble: powerMean(left.treble, right.treble), rms: powerMean(left.rms, right.rms),
            peak: max(left.peak, right.peak)
        )
    }
}
