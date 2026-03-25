
import { renderMultiRoiChart } from '../src/lib/ux/chartRenderer';
import fs from 'fs';
import path from 'path';

async function test() {
    console.log("Starting simple draw test...");
    
    const mockSeries = [
        {
            symbol: "2330",
            initialPrice: 500,
            data: [
                { date: new Date("2024-01-01"), close: 500 },
                { date: new Date("2024-01-02"), close: 510 },
                { date: new Date("2024-01-03"), close: 520 },
            ]
        },
        {
            symbol: "2317",
            initialPrice: 100,
            data: [
                { date: new Date("2024-01-01"), close: 100 },
                { date: new Date("2024-01-02"), close: 105 },
                { date: new Date("2024-01-03"), close: 102 },
            ]
        },
        {
            symbol: "AAPL",
            initialPrice: 180,
            data: [
                { date: new Date("2024-01-01"), close: 180 },
                { date: new Date("2024-01-02"), close: 185 },
                { date: new Date("2024-01-03"), close: 190 },
            ]
        }
    ];

    try {
        const buffer = await renderMultiRoiChart(mockSeries, "3d");
        const outputPath = path.join(process.cwd(), 'test_output_roi.png');
        fs.writeFileSync(outputPath, buffer);
        console.log(`Success! Chart saved to ${outputPath}`);
        console.log("Check if '2330 台積電' and '2317 鴻海' are displayed in the legend.");
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
