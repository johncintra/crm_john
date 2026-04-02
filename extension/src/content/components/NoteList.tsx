import { formatDate } from '../../shared/utils';
import type { LeadNote } from '../../shared/types';

export function NoteList({ notes }: { notes: LeadNote[] }) {
  return (
    <div className="crm-space-y-3">
      {notes.map((note) => (
        <article
          key={note.id}
          className="crm-rounded-2xl crm-border crm-border-white/8 crm-bg-white/[0.04] crm-p-3"
        >
          <div className="crm-flex crm-items-center crm-justify-between crm-gap-3">
            <span className="crm-text-xs crm-font-medium crm-text-slate-300">
              {note.authorName ?? 'Equipe'}
            </span>
            <span className="crm-text-[11px] crm-text-slate-500">{formatDate(note.createdAt)}</span>
          </div>
          <p className="crm-mt-2 crm-text-sm crm-leading-6 crm-text-slate-100">{note.content}</p>
        </article>
      ))}
    </div>
  );
}
