
async function run() {
    try {
        const res = await fetch('http://localhost:3002/api/scanner/volume');
        const data = await res.json();

        console.log("SYMBOL | PRICE   | RVOL | CHANGE  | ACTION");
        console.log("-------|---------|------|---------|-------");
        data
            .sort((a, b) => b.rvol - a.rvol)
            .slice(0, 10)
            .forEach(s => {
                console.log(`${s.symbol.padEnd(6)} | $${(s.price || 0).toFixed(2).padEnd(6)} | ${s.rvol.toFixed(2)} | ${(s.changePercent || 0).toFixed(2)}% | ${s.action}`);
            });
    } catch (e) {
        console.error(e);
    }
}
run();
