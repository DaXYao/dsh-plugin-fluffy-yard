/** 粒子四式（F9）：爱心（点击/摸摸/贴贴）、碎屑（吃）、水滴（喝）、闪光（添食/合影）。 */
export type ParticleKind = 'heart' | 'crumb' | 'drop' | 'sparkle'

export const PARTICLE_MARKUP: Record<ParticleKind, string> = {
  heart: '<path d="M0,2.6 C-2.6,-1 -5,-0.2 -5,-2.4 C-5,-4.6 -2.6,-4.8 0,-2.2 C2.6,-4.8 5,-4.6 5,-2.4 C5,-0.2 2.6,-1 0,2.6 Z" fill="#ef7d9d"/>',
  crumb: '<circle r="2.2" fill="#b07a3f"/>',
  drop: '<path d="M0,-3.4 C2,0.4 2.6,1.6 0,3.4 C-2.6,1.6 -2,0.4 0,-3.4 Z" fill="#7fb7e0"/>',
  sparkle: '<path d="M0,-4 L1.1,-1.1 L4,0 L1.1,1.1 L0,4 L-1.1,1.1 L-4,0 L-1.1,-1.1 Z" fill="#f5d76e"/>',
}
