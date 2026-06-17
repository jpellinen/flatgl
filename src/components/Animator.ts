export type AnimationPath = 'translation' | 'rotation' | 'scale';

export interface AnimationTrack {
  jointIndex: number;
  path: AnimationPath;
  times: Float32Array;
  values: Float32Array;
}

export interface AnimationClip {
  name: string;
  duration: number;
  tracks: AnimationTrack[];
}

import { Component } from '@/core/Component';

export class Animator extends Component {
  readonly clips: AnimationClip[];
  activeClip: AnimationClip | null = null;
  time = 0;
  speed = 1;
  loop = true;

  constructor(...clips: AnimationClip[]) {
    super();
    this.clips = clips;
  }

  play(name: string): void {
    const clip = this.clips.find((c) => c.name === name) ?? null;
    this.activeClip = clip;
    this.time = 0;
  }
}
