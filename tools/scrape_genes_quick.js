const fetch = require("node-fetch");
const cheerio = require("cheerio");
const fs = require("fs");

const PAGE = "https://rimworldwiki.com/wiki/Genes";
const supportedGermlines = [
    "Starjack",
    "Yttakin",
    "Hussar",
    "Sanguophage",
    "Waster",
    "Impid",
    "Pigskin",
    "Neanderthal",
    "Dirtmole",
    "Highmate",
    "Genie",
];
const supportedGermlineSet = new Set(supportedGermlines);

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

(async () => {
    console.log("Fetching", PAGE);
    const res = await fetch(PAGE);
    if (!res.ok) throw new Error("Failed to fetch page: " + res.status);
    const html = await res.text();
    const $ = cheerio.load(html);

    const genes = [];

    const fuzzySearch = (text, target) => {
        const $target = $(target);
        const lower = text.toLowerCase();

        // Direct text match
        if ($target.text().toLowerCase().includes(lower)) {
            return true;
        }

        // Search titles of descendants
        let found = false;
        $target.find("[title]").each((_, el) => {
            const title = $(el).attr("title")?.toLowerCase() || "";
            if (title.includes(lower)) {
                found = true;
                return false; // breaks out of .each()
            }
        });

        return found;
    };

    const parseImageSrc = (src) => {
        const parts = src.split("/");
        const filename = parts.find((p) =>
            /\.(png|jpg|jpeg|gif|webp)$/i.test(p),
        );
        return filename || "";
    };

    const toSingular = (name) => {
        if (!name) return "";
        const normalized = name.endsWith("s") ? name.slice(0, -1) : name;
        if (!supportedGermlineSet.has(normalized)) {
            throw new Error(
                `Found germline "${name}" (normalized "${normalized}" that does not exist in the supported germlines list)`,
            );
        }
        return normalized;
    };

    const parseSourceXenos = (cell) => {
        const sourceNames = [];
        const seen = new Set();

        const addName = (raw) => {
            if (!raw) return;
            const trimmed = raw.trim();
            if (!trimmed || trimmed === "-") return;
            const name = toSingular(trimmed);
            if (seen.has(name)) return;
            seen.add(name);
            sourceNames.push(name);
        };

        cell.find("a[title]").each((_, el) => {
            const title = $(el).attr("title");
            addName(title);
        });

        if (sourceNames.length === 0) {
            cell
                .text()
                .split(/[\n,\/]+/)
                .forEach(addName);
        }

        return sourceNames;
    };

    // Look for tables in the content area and collect rows that look like gene entries
    $(".mw-collapsible-content table").each((i, table) => {
        let skipTable = false;

        let nameCol = null;
        let descriptionCol = null;
        let metabolismCol = null;
        let complexityCol = null;
        let capsulesCol = null;
        let sourceXenoCol = null;
        let conflictsCol = null;

        // find column indices
        const headerRow = $(table).find("tbody tr").eq(0);

        $(headerRow)
            .find("th, td")
            .each((column, th) => {
                if (fuzzySearch("name", $(th))) {
                    nameCol = column;
                } else if (fuzzySearch("description", $(th))) {
                    descriptionCol = column;
                } else if (fuzzySearch("metabolism", $(th))) {
                    metabolismCol = column;
                } else if (fuzzySearch("complexity", $(th))) {
                    complexityCol = column;
                } else if (fuzzySearch("capsules", $(th))) {
                    capsulesCol = column;
                } else if (fuzzySearch("xenotypes", $(th))) {
                    sourceXenoCol = column;
                } else if (fuzzySearch("exclude", $(th))) {
                    conflictsCol = column;
                }
            });

        // If we didn't find a name column, skip this table
        if (nameCol === null) return;

        $(table)
            .find("tbody tr")
            .each((j, tr) => {
                if (skipTable) return; // skip entire table if flagged

                if (j === 0) return; // skip header row

                const tds = $(tr).find("td, th");

                // Find first anchor in first cell
                const nameCell = tds.eq(0);
                const name = nameCell.text().trim();

                const imgSrc = nameCell.find("img").attr("src") || "";

                const description =
                    descriptionCol !== null
                        ? tds.eq(descriptionCol).text().trim()
                        : "";
                const metabolism =
                    metabolismCol !== null
                        ? parseInt(tds.eq(metabolismCol).text().trim().replace('−', '-'), 10)
                        : null;
                const complexity =
                    complexityCol !== null
                        ? parseInt(tds.eq(complexityCol).text().trim().replace('−', '-'), 10)
                        : null;
                const capsules =
                    capsulesCol !== null
                        ? tds.eq(capsulesCol).text().trim()
                        : "";
                const sourceXenos =
                    sourceXenoCol !== null
                        ? parseSourceXenos(tds.eq(sourceXenoCol))
                        : [];

                const conflicts =
                    conflictsCol !== null
                        ? tds
                              .eq(conflictsCol)
                              .html()
                              .split(/<br\s*\/?>/i)
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .filter((str) => str !== "-")
                        : "";

                // Skip cosmetic gene tables
                if (
                    name === "Red eyes" ||
                    name === "Standard body" ||
                    name === "Snow-white hair" ||
                    name === "Skin_Melanin1" ||
                    name === "Green skin" ||
                    name === "Resurrect"
                ) {
                    skipTable = true;
                    return;
                }

                genes.push({
                    id: slugify(name),
                    name,
                    description,
                    efficiency: metabolism === null ? undefined : metabolism,
                    complexity: complexity === null ? undefined : complexity,
                    capsules: capsules ? capsules : undefined,
                    sourceXenos: sourceXenos.length ? sourceXenos : undefined,
                    conflicts: conflicts ? conflicts : undefined,
                    imgSrc: `64px-${parseImageSrc(imgSrc)}`,
                });
            });

        skipTable = false; // reset for next table
    });

    // Deduplicate by id, keeping first
    const seen = new Set();
    const finalGenes = [];
    for (const g of genes) {
        if (!seen.has(g.id)) {
            seen.add(g.id);
            finalGenes.push(g);
        }
    }

    const germlinesWithAtLeastOneGene = new Set();
    for (const gene of finalGenes) {
        if (!Array.isArray(gene.sourceXenos)) continue;
        for (const sourceName of gene.sourceXenos) {
            if (!supportedGermlineSet.has(sourceName)) {
                throw new Error(
                    `Gene "${gene.name}" references unsupported germline "${sourceName}"`,
                );
            }
            germlinesWithAtLeastOneGene.add(sourceName);
        }
    }

    // Find any supported germlines that have no genes associated with them
    const missingGermlines = supportedGermlines.filter(
        (name) => !germlinesWithAtLeastOneGene.has(name),
    );
    if (missingGermlines.length > 0) {
        throw new Error(
            `No genes matched for germlines: ${missingGermlines.join(", ")}
            This indicates an error in the scraping/parsing process, since all germlines should have at least one gene associated with them.`,
        );
    }

    console.log("Found", finalGenes.length, "candidate gene entries");

    // Write to src/data/genes.json
    const outPath = "src/data/genes.json";
    fs.writeFileSync(outPath, JSON.stringify({genes: finalGenes}, null, 2), "utf8");
    console.log("Wrote", outPath);

    // Now generate germlines.json
    // Generate germlines map from supported germlines array and finalGenes
    const germlines = supportedGermlines.map((germlineName) => {
        const germlineGenes = finalGenes
            .filter((gene) => gene.sourceXenos?.includes(germlineName))
            .map((g) => g.id);

        return {
            name: germlineName,
            genes: germlineGenes,
        };
    });

    const germlinesPath = "src/data/germlines.json";
    fs.writeFileSync(germlinesPath, JSON.stringify({germlines: germlines}, null, 2), "utf8");
    console.log("Wrote", germlinesPath);
})();
