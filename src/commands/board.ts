import { boardApi, requireProjectConfig } from '../lib/api.js';

interface Column {
  id: string;
  name: string;
  position: number;
  color: string;
  wipLimit: number | null;
  cards: Card[];
}

interface Card {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  position: number;
  dueDate: string | null;
  estimate: number | null;
  assignees: { userId: string; email: string; name: string | null }[];
  labels: { id: string; name: string; color: string }[];
  paymentStatus: string | null;
  priceCents: number | null;
}

interface BoardData {
  id: string;
  columns: Column[];
  labels: { id: string; name: string; color: string }[];
  cardTypes: { id: string; name: string; color: string }[];
}

export const boardCommand = {
  async show(): Promise<void> {
    const config = requireProjectConfig();

    try {
      const result = await boardApi(`/projects/${config.projectId}/board`) as { board: BoardData };
      const board = result.board;

      console.log(`Board for project ${config.projectId}\n`);

      // Show card types and labels
      if (board.cardTypes?.length) {
        console.log(`Card types: ${board.cardTypes.map(t => t.name).join(', ')}`);
      }
      if (board.labels?.length) {
        console.log(`Labels: ${board.labels.map(l => l.name).join(', ')}`);
      }
      console.log('');

      // Show columns with cards
      for (const col of board.columns) {
        const wipStr = col.wipLimit ? ` (WIP: ${col.cards.length}/${col.wipLimit})` : ` (${col.cards.length})`;
        console.log(`── ${col.name}${wipStr} ──`);

        if (!col.cards.length) {
          console.log('  (empty)\n');
          continue;
        }

        for (const card of col.cards) {
          const parts: string[] = [];
          if (card.type !== 'task') parts.push(`[${card.type}]`);
          if (card.priority !== 'medium') parts.push(`{${card.priority}}`);
          if (card.dueDate) parts.push(`due:${card.dueDate}`);
          if (card.assignees?.length) parts.push(`→ ${card.assignees.map(a => a.name || a.email).join(', ')}`);
          if (card.paymentStatus) parts.push(`💰${card.paymentStatus}`);

          const meta = parts.length ? `  ${parts.join(' ')}` : '';
          console.log(`  ${card.id}  ${card.title}${meta}`);
        }
        console.log('');
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async create(title: string, opts: { column?: string; type?: string; priority?: string; description?: string }): Promise<void> {
    const config = requireProjectConfig();

    try {
      // Get board to find column ID
      const result = await boardApi(`/projects/${config.projectId}/board`) as { board: BoardData };
      const board = result.board;

      let columnId: string;
      if (opts.column) {
        const col = board.columns.find(c => c.name.toLowerCase() === opts.column!.toLowerCase());
        if (!col) {
          console.error(`Column "${opts.column}" not found. Available: ${board.columns.map(c => c.name).join(', ')}`);
          process.exit(1);
        }
        columnId = col.id;
      } else {
        // Default to first column (Backlog)
        columnId = board.columns[0].id;
      }

      const body: Record<string, unknown> = { columnId, title };
      if (opts.type) body.type = opts.type;
      if (opts.priority) body.priority = opts.priority;
      if (opts.description) body.description = opts.description;

      const card = await boardApi(`/projects/${config.projectId}/cards`, {
        method: 'POST',
        body,
      }) as { card: { id: string; title: string } };

      console.log(`Created card #${card.card.id}: ${card.card.title}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async update(cardId: string, opts: { title?: string; description?: string; priority?: string; status?: string; type?: string }): Promise<void> {
    const config = requireProjectConfig();

    try {
      const body: Record<string, unknown> = {};
      if (opts.title) body.title = opts.title;
      if (opts.description) body.description = opts.description;
      if (opts.priority) body.priority = opts.priority;
      if (opts.status) body.status = opts.status;
      if (opts.type) body.type = opts.type;

      if (Object.keys(body).length === 0) {
        console.error('No fields to update. Use --title, --description, --priority, --status, or --type');
        process.exit(1);
      }

      await boardApi(`/projects/${config.projectId}/cards/${cardId}`, {
        method: 'PUT',
        body,
      });

      console.log(`Updated card #${cardId}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async move(cardId: string, columnName: string): Promise<void> {
    const config = requireProjectConfig();

    try {
      // Get board to find column ID by name
      const result = await boardApi(`/projects/${config.projectId}/board`) as { board: BoardData };
      const col = result.board.columns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
      if (!col) {
        console.error(`Column "${columnName}" not found. Available: ${result.board.columns.map(c => c.name).join(', ')}`);
        process.exit(1);
      }

      await boardApi(`/projects/${config.projectId}/cards/${cardId}/move`, {
        method: 'POST',
        body: { columnId: col.id, position: 999999 },
      });

      console.log(`Moved card #${cardId} to "${col.name}"`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async comment(cardId: string, message: string): Promise<void> {
    const config = requireProjectConfig();

    try {
      await boardApi(`/projects/${config.projectId}/cards/${cardId}/comments`, {
        method: 'POST',
        body: { body: message },
      });

      console.log(`Comment added to card #${cardId}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async del(cardId: string): Promise<void> {
    const config = requireProjectConfig();

    try {
      await boardApi(`/projects/${config.projectId}/cards/${cardId}`, {
        method: 'DELETE',
      });

      console.log(`Deleted card #${cardId}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },
};
