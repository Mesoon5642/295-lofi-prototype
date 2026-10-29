// npm run audio:generate: makes a .wav speech clip for every phrase the app can say
// (game descriptions, instructions, and each seed word) into server/audio/, using the
// Windows built-in voice (System.Speech). Placeholder voice: replace any file with a
// real recording of the same name and nothing else needs to change.
//
// Windows only. On other systems, record or copy the files in by hand.
// Words added to the database later need a clip too (same naming: src/audio/clips.js).

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ACTIVITIES } from '../../src/content/activities.js'
import { spokenPhrases } from '../../src/audio/clips.js'
import { AUDIO_DIR } from '../app.js'
import { SEED_WORDS } from '../seed/words.js'

// System.Speech rate runs -10..10; -2 is a little slower than normal for new readers.
const RATE = -2

if (process.platform !== 'win32') {
  console.error('audio:generate uses the Windows speech engine. Add clips to server/audio by hand.')
  process.exit(1)
}

mkdirSync(AUDIO_DIR, { recursive: true })
const clips = spokenPhrases(ACTIVITIES, SEED_WORDS).map(({ name, text }) => ({
  text,
  file: path.join(AUDIO_DIR, `${name}.wav`),
}))

const workDir = path.join(tmpdir(), `reading-game-audio-${process.pid}`)
mkdirSync(workDir, { recursive: true })
const listFile = path.join(workDir, 'clips.json')
const scriptFile = path.join(workDir, 'speak.ps1')
writeFileSync(listFile, JSON.stringify(clips))
writeFileSync(
  scriptFile,
  `param([string]$List)
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.Rate = ${RATE}
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($clip in (Get-Content -Raw -Encoding UTF8 $List | ConvertFrom-Json)) {
  $voice.SetOutputToWaveFile($clip.file, $format)
  $voice.Speak($clip.text)
}
$voice.SetOutputToNull()
$voice.Dispose()
`,
)

try {
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptFile, '-List', listFile],
    { stdio: 'inherit' },
  )
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
for (const clip of clips) console.log(`${path.basename(clip.file)}  "${clip.text}"`)
console.log(`Wrote ${clips.length} clips to ${AUDIO_DIR}`)
