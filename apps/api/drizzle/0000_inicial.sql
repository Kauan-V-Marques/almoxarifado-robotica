CREATE TYPE "public"."category" AS ENUM('sensor', 'motor', 'controlador', 'bateria', 'eletronica', 'mecanica', 'ferramenta');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('captain', 'member');--> statement-breakpoint
CREATE TABLE "components" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"sku" varchar(20) NOT NULL,
	"category" "category" NOT NULL,
	"quantity" integer NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"location" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "components_quantity_non_negative" CHECK ("components"."quantity" >= 0),
	CONSTRAINT "components_min_quantity_non_negative" CHECK ("components"."min_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"component_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"purpose" varchar(120) NOT NULL,
	"borrowed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"returned_at" timestamp with time zone,
	CONSTRAINT "loans_quantity_positive" CHECK ("loans"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"email" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "components_sku_unique" ON "components" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "loans_open_idx" ON "loans" USING btree ("component_id") WHERE "loans"."returned_at" is null;--> statement-breakpoint
CREATE INDEX "loans_user_idx" ON "loans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_unique" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");