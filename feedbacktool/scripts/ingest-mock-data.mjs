import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const DATASET_FILES = {
	seed: "seed.json",
	stream: "stream.json",
	followup: "followup.json",
};

function parseArgs(argv) {
	const options = {
		dataset: "all",
		url: "http://localhost:5173",
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--dataset" && argv[i + 1]) {
			options.dataset = argv[i + 1];
			i += 1;
			continue;
		}
		if (arg === "--url" && argv[i + 1]) {
			options.url = argv[i + 1];
			i += 1;
		}
	}

	return options;
}

async function readDataset(name) {
	const fileName = DATASET_FILES[name];
	if (!fileName) {
		throw new Error(
			`Unknown dataset "${name}". Use seed, stream, followup, or all.`,
		);
	}

	const filePath = path.join(projectRoot, "public", "data", fileName);
	const contents = await readFile(filePath, "utf8");
	const parsed = JSON.parse(contents);
	if (!Array.isArray(parsed)) {
		throw new Error(`Dataset ${name} is not a JSON array.`);
	}

	return parsed;
}

async function loadItems(dataset) {
	if (dataset === "all") {
		const results = await Promise.all([
			readDataset("seed"),
			readDataset("stream"),
			readDataset("followup"),
		]);
		return results.flat();
	}

	return readDataset(dataset);
}

async function main() {
	const { dataset, url } = parseArgs(process.argv.slice(2));
	const items = await loadItems(dataset);
	const endpoint = `${url.replace(/\/$/, "")}/api/ingest`;

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({ items }),
	});

	const data = await response.json();
	if (!response.ok) {
		throw new Error(
			typeof data?.error?.message === "string"
				? data.error.message
				: `Request failed with ${response.status}.`,
		);
	}

	process.stdout.write(
		JSON.stringify(
			{
				url,
				dataset,
				sent: items.length,
				inserted: data.inserted ?? 0,
				skipped: data.skipped ?? 0,
			},
			null,
			2,
		) + "\n",
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
