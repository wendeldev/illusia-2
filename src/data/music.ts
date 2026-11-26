// Trilhas sonoras (compostas pelo motor de música em src/engine/music.ts).
// Para mudar o clima de uma região: troque a escala, o andamento (bpm) ou os instrumentos.
import type { TrackDef } from '../engine/music';
import type { SceneryTheme } from '../types';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const PHRYGIAN_DOMINANT = [0, 1, 4, 5, 7, 8, 10];

const FOUR = [0, 4, 8, 12];
const EIGHTS = [0, 2, 4, 6, 8, 10, 12, 14];
const OFFBEATS = [2, 6, 10, 14];

export const TRACKS: Record<SceneryTheme | 'boss', TrackDef> = {
  village: {
    id: 'village', bpm: 96, root: 60, scale: MAJOR, prog: [0, 3, 4, 0, 5, 3, 1, 4],
    pad: { wave: 'triangle', vol: 0.05 },
    bass: { wave: 'triangle', steps: [0, 6, 8, 14], vol: 0.16 },
    arp: { wave: 'triangle', steps: EIGHTS, octave: 1, vol: 0.035 },
    lead: { wave: 'sine', density: 0.55, octave: 1, vol: 0.09, vibrato: true },
    drums: { kick: [0, 8], snare: [], hat: OFFBEATS, vol: 0.25 },
    filter: 3200,
  },
  forest: {
    id: 'forest', bpm: 100, root: 62, scale: LYDIAN, prog: [0, 1, 4, 0, 5, 1, 3, 4],
    pad: { wave: 'sine', vol: 0.06 },
    bass: { wave: 'triangle', steps: [0, 10], vol: 0.15 },
    arp: { wave: 'triangle', steps: [0, 3, 6, 8, 11, 14], octave: 1, vol: 0.035 },
    lead: { wave: 'sine', density: 0.5, octave: 1, vol: 0.09, vibrato: true },
    drums: { kick: [0, 10], snare: [8], hat: [4, 12], vol: 0.2 },
    filter: 2800, echo: 0.25,
  },
  swamp: {
    id: 'swamp', bpm: 80, root: 57, scale: DORIAN, prog: [0, 0, 3, 3, 4, 3, 0, 6],
    pad: { wave: 'sawtooth', vol: 0.025 },
    bass: { wave: 'sine', steps: [0, 7, 10], vol: 0.2 },
    arp: { wave: 'triangle', steps: [0, 6, 12], octave: 0, vol: 0.05 },
    lead: { wave: 'triangle', density: 0.35, octave: 1, vol: 0.07, vibrato: true },
    drums: { kick: [0, 7], snare: [12], hat: [], vol: 0.2 },
    filter: 1400, echo: 0.35,
  },
  ruins: {
    id: 'ruins', bpm: 92, root: 57, scale: HARMONIC_MINOR, prog: [0, 5, 3, 4, 0, 5, 1, 4],
    pad: { wave: 'triangle', vol: 0.05 },
    bass: { wave: 'triangle', steps: [0, 3, 8, 11], vol: 0.16 },
    arp: { wave: 'square', steps: [0, 4, 8, 12], octave: 1, vol: 0.02 },
    lead: { wave: 'triangle', density: 0.5, octave: 1, vol: 0.08, vibrato: true },
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14], vol: 0.22 },
    filter: 2600,
  },
  desert: {
    id: 'desert', bpm: 104, root: 62, scale: PHRYGIAN_DOMINANT, prog: [0, 1, 0, 6, 0, 1, 3, 0],
    pad: { wave: 'sawtooth', vol: 0.02 },
    bass: { wave: 'triangle', steps: [0, 3, 6, 8, 11, 14], vol: 0.15 },
    arp: { wave: 'triangle', steps: [0, 2, 3, 8, 10, 11], octave: 1, vol: 0.035 },
    lead: { wave: 'sawtooth', density: 0.55, octave: 1, vol: 0.035, vibrato: true },
    drums: { kick: [0, 6, 8], snare: [12], hat: [3, 7, 11, 15], vol: 0.25 },
    filter: 2400,
  },
  cave: {
    id: 'cave', bpm: 70, root: 55, scale: MINOR, prog: [0, 5, 3, 4, 0, 5, 6, 4],
    pad: { wave: 'sine', vol: 0.07 },
    bass: { wave: 'sine', steps: [0, 12], vol: 0.18 },
    arp: { wave: 'sine', steps: [0, 5, 10], octave: 2, vol: 0.04 },
    lead: { wave: 'sine', density: 0.25, octave: 1, vol: 0.07 },
    filter: 1800, echo: 0.5,
  },
  snow: {
    id: 'snow', bpm: 84, root: 64, scale: MAJOR, prog: [0, 5, 3, 4, 0, 2, 3, 4],
    pad: { wave: 'sine', vol: 0.06 },
    bass: { wave: 'sine', steps: [0, 8], vol: 0.15 },
    arp: { wave: 'sine', steps: [0, 2, 4, 6, 8, 10, 12, 14], octave: 2, vol: 0.03 },
    lead: { wave: 'triangle', density: 0.4, octave: 1, vol: 0.07 },
    drums: { kick: [0], snare: [], hat: [8], vol: 0.12 },
    filter: 4000, echo: 0.4,
  },
  volcano: {
    id: 'volcano', bpm: 128, root: 52, scale: MINOR, prog: [0, 0, 5, 6, 0, 0, 3, 4],
    pad: { wave: 'sawtooth', vol: 0.025 },
    bass: { wave: 'sawtooth', steps: EIGHTS, vol: 0.1 },
    arp: { wave: 'square', steps: [0, 3, 6, 8, 11, 14], octave: 1, vol: 0.02 },
    lead: { wave: 'square', density: 0.45, octave: 1, vol: 0.035 },
    drums: { kick: [0, 3, 8, 11], snare: [4, 12], hat: EIGHTS, vol: 0.3 },
    filter: 2200,
  },
  castle: {
    id: 'castle', bpm: 108, root: 50, scale: HARMONIC_MINOR, prog: [0, 3, 4, 0, 5, 1, 4, 4],
    pad: { wave: 'square', vol: 0.025 },
    bass: { wave: 'triangle', steps: [0, 4, 8, 12], vol: 0.16 },
    arp: { wave: 'square', steps: EIGHTS, octave: 1, vol: 0.018 },
    lead: { wave: 'square', density: 0.4, octave: 1, vol: 0.03, vibrato: true },
    drums: { kick: [0, 8], snare: [12], hat: OFFBEATS, vol: 0.22 },
    filter: 1900, echo: 0.3,
  },
  sky: {
    id: 'sky', bpm: 112, root: 65, scale: MIXOLYDIAN, prog: [0, 6, 3, 0, 4, 6, 3, 4],
    pad: { wave: 'triangle', vol: 0.05 },
    bass: { wave: 'triangle', steps: [0, 3, 8, 11], vol: 0.14 },
    arp: { wave: 'triangle', steps: [0, 2, 4, 6, 8, 10, 12, 14], octave: 1, vol: 0.035 },
    lead: { wave: 'sine', density: 0.6, octave: 1, vol: 0.09, vibrato: true },
    drums: { kick: FOUR, snare: [4, 12], hat: OFFBEATS, vol: 0.22 },
    filter: 4200, echo: 0.2,
  },
  boss: {
    id: 'boss', bpm: 144, root: 52, scale: HARMONIC_MINOR, prog: [0, 0, 5, 4, 0, 0, 1, 4],
    pad: { wave: 'sawtooth', vol: 0.03 },
    bass: { wave: 'sawtooth', steps: EIGHTS, vol: 0.12 },
    arp: { wave: 'square', steps: [0, 2, 3, 5, 6, 8, 10, 11, 13, 14], octave: 1, vol: 0.022 },
    lead: { wave: 'square', density: 0.6, octave: 1, vol: 0.035 },
    drums: { kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: EIGHTS, vol: 0.32 },
    filter: 2600,
  },
};
