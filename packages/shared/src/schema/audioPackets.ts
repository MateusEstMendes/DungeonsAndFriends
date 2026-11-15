import { z } from 'zod';
export const MasterNarrativeSfxSchema = z.object({ effect: z.enum(['master_thunder', 'master_door_slam']) }).strict();
