import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const characters = sqliteTable('characters', {
  owner: text('owner').notNull(), slot: integer('slot').notNull(), revision: integer('revision').notNull(),
  object: text('object'), previous: text('previous'), summary: text('summary'),
  chronicle: text('chronicle'),
  rankName: text('rank_name'), rankLevel: integer('rank_level'), rankGear: integer('rank_gear'),
  rankGearCheckedAt: integer('rank_gear_checked_at'),
  /** -1 marks a readable save with no recorded rift clears; NULL means never scored. */
  rankRift: integer('rank_rift'), rankRiftSeconds: real('rank_rift_seconds'),
  rankRiftCheckedAt: integer('rank_rift_checked_at'),
  operation: text('operation').notNull(), digest: text('digest').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.slot] }), index('characters_rank_level').on(table.rankLevel, table.rankGear), index('characters_rank_gear').on(table.rankGear, table.rankLevel), index('characters_rank_rift').on(table.rankRift, table.rankRiftSeconds)]);
