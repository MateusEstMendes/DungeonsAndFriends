import type { RaceId } from '@df/shared';

// Shared registration keeps eyes, ears, hair and facial hair fitted to each head.
export interface RaceAppearance {
 headWidth: number;
 headHeight: number;
 hair: string;
 eyes: string;
 details: string;
 horns: string;
 backHair: 'none' | 'short' | 'long' | 'braids';
 frontHair: 'none' | 'short' | 'swept' | 'fringe';
 beard: 'none' | 'beard' | 'braided';
}
export const RACE_APPEARANCE: Record<RaceId, RaceAppearance> = {
 HUMAN: {headWidth:1,headHeight:1,hair:'#775449',eyes:'#8EA85E',details:'#A57960',horns:'#8D7975',backHair:'none',frontHair:'none',beard:'none'},
 DWARF: {headWidth:1.1,headHeight:.94,hair:'#875333',eyes:'#9B713F',details:'#956744',horns:'#8D7975',backHair:'braids',frontHair:'short',beard:'braided'},
 ELF: {headWidth:.94,headHeight:1.03,hair:'#D4C18B',eyes:'#59917B',details:'#AF9970',horns:'#8D7975',backHair:'long',frontHair:'swept',beard:'none'},
 ORC: {headWidth:1.12,headHeight:1,hair:'#343A2B',eyes:'#C6A14C',details:'#697846',horns:'#8D7975',backHair:'short',frontHair:'short',beard:'none'},
 VAMPIRE: {headWidth:.95,headHeight:1.02,hair:'#302C3B',eyes:'#B94351',details:'#A88394',horns:'#8D7975',backHair:'long',frontHair:'swept',beard:'none'},
 DEMON: {headWidth:.98,headHeight:1,hair:'#392C36',eyes:'#E8AC52',details:'#924F50',horns:'#51404B',backHair:'short',frontHair:'fringe',beard:'none'},
 HALF_DRAGON: {headWidth:1.03,headHeight:1,hair:'#4D6260',eyes:'#39C9BD',details:'#587E77',horns:'#C2AC7E',backHair:'short',frontHair:'swept',beard:'none'},
 HALF_SHARK: {headWidth:1.05,headHeight:.98,hair:'#344D63',eyes:'#5DB7C4',details:'#657E96',horns:'#8D7975',backHair:'short',frontHair:'short',beard:'none'},
};
export function headTransform(race: RaceId): string {
 const {headWidth:x,headHeight:y}=RACE_APPEARANCE[race];
 return `translate(256 220) scale(${x} ${y}) translate(-256 -220)`;
}
