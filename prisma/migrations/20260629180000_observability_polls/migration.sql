-- Sweeper heartbeat (observability) + live polls / exit tickets.
CREATE TABLE "SweeperRun" (
    "id" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "ticks" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SweeperRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'mcq',
    "options" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Poll_classroomId_idx" ON "Poll"("classroomId");
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PollResponse" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "choice" INTEGER,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PollResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PollResponse_pollId_studentId_key" ON "PollResponse"("pollId", "studentId");
ALTER TABLE "PollResponse" ADD CONSTRAINT "PollResponse_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
