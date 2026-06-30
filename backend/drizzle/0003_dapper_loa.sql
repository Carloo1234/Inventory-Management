CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token" varchar(64) NOT NULL,
	"auth_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;