export type CorridorNote = { id: string; noteText: string; createdAt: string; updatedAt: string; isOwn: boolean };
export type CorridorCursor = { createdAt: string; id: string };
export type CorridorPage = { notes: CorridorNote[]; ownNote: CorridorNote | null; nextCursor: CorridorCursor | null };
