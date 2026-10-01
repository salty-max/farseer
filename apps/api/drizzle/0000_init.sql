CREATE TABLE "categories" (
	"region" text NOT NULL,
	"id" integer NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"forum_post_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"topic_slug" text NOT NULL,
	"topic_title" text NOT NULL,
	"post_number" integer NOT NULL,
	"category_id" integer NOT NULL,
	"category" text NOT NULL,
	"username" text NOT NULL,
	"user_title" text,
	"role" text NOT NULL,
	"avatar_url" text,
	"excerpt" text NOT NULL,
	"html" text,
	"text" text DEFAULT '' NOT NULL,
	"reply_to" jsonb,
	"game" text NOT NULL,
	"topics" text[] NOT NULL,
	"regions" text[] NOT NULL,
	"dup_of" integer,
	"chatter" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_id" text NOT NULL,
	"filters" jsonb NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "categories_region_id" ON "categories" USING btree ("region","id");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_region_forum_post" ON "posts" USING btree ("region","forum_post_id");--> statement-breakpoint
CREATE INDEX "posts_created" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_feed" ON "posts" USING btree ("dup_of","chatter","created_at");