CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"shop_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"invited_user_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_shop_invited_user" UNIQUE("shop_id","invited_user_id")
);
--> statement-breakpoint
CREATE TABLE "shop_managers" (
	"shop_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"invited_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_managers_shop_id_manager_id_pk" PRIMARY KEY("shop_id","manager_id")
);
--> statement-breakpoint
ALTER TABLE "shops" RENAME COLUMN "softDelete" TO "soft_delete";--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_managers" ADD CONSTRAINT "shop_managers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_managers" ADD CONSTRAINT "shop_managers_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_managers" ADD CONSTRAINT "shop_managers_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_managers" ADD CONSTRAINT "shop_managers_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;