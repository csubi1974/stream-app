
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_change_me_in_production_32_chars';
const IV_LENGTH = 12;
const ALGORITHM = 'aes-256-gcm';

function decrypt(text) {
    try {
        const [ivHex, tagHex, encryptedData] = text.split(':');
        if (!ivHex || !tagHex || !encryptedData) return text;
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        return text;
    }
}

async function testHistory() {
    const tokensPath = path.join(process.cwd(), 'tokens.json');
    if (!fs.existsSync(tokensPath)) {
        console.error("No tokens.json found");
        return;
    }

    const fileContent = fs.readFileSync(tokensPath, 'utf-8');
    let tokens;
    try {
        tokens = JSON.parse(fileContent);
    } catch (e) {
        tokens = JSON.parse(decrypt(fileContent));
    }

    const accessToken = tokens.accessToken;
    const baseURL = process.env.SCHWAB_API_BASE || 'https://api.schwabapi.com';

    const testParams = [
        { symbol: '$SPX', periodType: 'day', period: 1, frequencyType: 'minute', frequency: 5 },
        { symbol: '$SPX', periodType: 'day', period: 2, frequencyType: 'minute', frequency: 5 },
        { symbol: 'SPX', periodType: 'day', period: 1, frequencyType: 'minute', frequency: 5 }
    ];

    for (const params of testParams) {
        console.log(`\n--- Testing: ${JSON.stringify(params)} ---`);
        try {
            const res = await axios.get(`${baseURL}/marketdata/v1/pricehistory`, {
                params,
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const candles = res.data.candles || [];
            console.log(`Result: ${candles.length} candles`);
            if (candles.length > 0) {
                const first = new Date(candles[0].datetime).toLocaleString();
                const last = new Date(candles[candles.length - 1].datetime).toLocaleString();
                console.log(`First: ${first}`);
                console.log(`Last: ${last}`);
            }
        } catch (error) {
            console.error(`Error: ${error.message} - ${JSON.stringify(error.response?.data)}`);
        }
    }
}

testHistory();
