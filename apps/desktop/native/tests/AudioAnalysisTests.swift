import Foundation

@main
struct AudioAnalysisTests {
    static func main() {
        let analyzer = AudioAnalyzer()!
        let silence = analyzer.frame(sampleRate: 48000)
        precondition(silence.rms == 0 && silence.bass == 0 && silence.spectrum.allSatisfy { $0 == 0 })
        func tone(_ frequency: Float) -> AudioAnalysisFrame {
            analyzer.reset()
            for index in 0..<AudioAnalyzer.size {
                analyzer.append(0.5 * sin(2 * .pi * frequency * Float(index) / 48000))
            }
            return analyzer.frame(sampleRate: 48000)
        }
        let bass = tone(70)
        let mid = tone(1000)
        let treble = tone(6000)
        precondition(bass.bass > 0.3 && bass.bass > 50 * bass.treble)
        precondition(mid.mid > 0.3 && mid.mid > 50 * mid.bass)
        precondition(treble.treble > 0.3 && treble.treble > 50 * treble.bass)
        precondition(treble.waveform.max()! > 0.49 && treble.waveform.min()! < -0.49, "6 kHz must retain visible waveform extrema")
        precondition(bass.waveform.max()! > 0.49 && bass.waveform.min()! < -0.49, "Bass must retain visible waveform extrema")
        for frame in [bass, mid, treble] {
            precondition(frame.spectrum.count == 64 && frame.waveform.count == 128)
            precondition(abs(frame.rms - 0.3535) < 0.015)
            precondition(frame.spectrum.allSatisfy { $0.isFinite && $0 >= 0 && $0 <= 1 })
            precondition(frame.waveform.allSatisfy { $0.isFinite && $0 >= -1 && $0 <= 1 })
        }
        for _ in 0..<AudioAnalyzer.size { analyzer.append(0) }
        let stopped = analyzer.frame(sampleRate: 48000)
        precondition(stopped.peak == 0 && stopped.bass == 0 && stopped.waveform.allSatisfy { $0 == 0 })
        analyzer.append(.nan)
        analyzer.append(.infinity)
        precondition(analyzer.frame(sampleRate: 48000).rms == 0)
        analyzer.reset()
        for index in 0..<AudioAnalyzer.size { analyzer.append(index % 32 == 4 ? 0.7 : index % 32 == 25 ? -0.6 : 0) }
        let ordered = analyzer.frame(sampleRate: 48000)
        precondition(stride(from: 0, to: 128, by: 2).allSatisfy { ordered.waveform[$0] == 0.7 && ordered.waveform[$0 + 1] == -0.6 }, "Waveform extrema must retain temporal order")
        let stereo = StereoAudioAnalyzer()!
        for index in 0..<AudioAnalyzer.size {
            let sample = 0.5 * sin(2 * Float.pi * 70 * Float(index) / 48000)
            stereo.append(left: sample, right: -sample)
        }
        let antiphase = stereo.frame(sampleRate: 48000)
        precondition(antiphase.bass > 0.3 && antiphase.rms > 0.3)
        print("PASS silence, 70 Hz bass, 1 kHz mids, 6 kHz treble, visible waveform extrema, extrema temporal order, sample ranges, silence after playback, nonfinite input, antiphase stereo")
        print("bass=\(bass.bass) mid=\(mid.mid) treble=\(treble.treble)")
    }
}
