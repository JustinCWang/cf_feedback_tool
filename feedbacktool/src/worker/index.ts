import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

type HealthCheckRow = {
	ok: number;
};

app.get("/api", (c) =>
	c.json({
		name: "feedbacktool",
		status: "ok",
	}),
);

app.get("/api/health", async (c) => {
	try {
		const result = await c.env.DB.prepare("SELECT 1 AS ok").first<HealthCheckRow>();

		return c.json({
			status: "ok",
			time: new Date().toISOString(),
			database: result?.ok === 1 ? "connected" : "unknown",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown database error";

		return c.json(
			{
				error: {
					code: "database_unavailable",
					message,
				},
			},
			500,
		);
	}
});

export default app;
