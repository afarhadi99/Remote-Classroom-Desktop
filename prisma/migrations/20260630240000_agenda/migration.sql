-- Lesson agenda: ordered step texts + current step index.
ALTER TABLE "Classroom" ADD COLUMN "agenda" JSONB;
ALTER TABLE "Classroom" ADD COLUMN "agendaStep" INTEGER;
