CREATE TABLE "evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"author_role" text NOT NULL,
	"note" text NOT NULL,
	"file_name" text,
	"file_type" text,
	"file_size" integer,
	"file_sha256" char(64),
	"file_data" "bytea",
	"created_h" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;