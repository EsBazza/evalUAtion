const { Client } = require('pg');
const connectionString = "postgresql://postgres.qszmmfonugfpligxsmpz:evaluatepogi123@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'EvaluationReceipt';
  `);
  console.log(res.rows);
  await client.end();
}

main().catch(console.error);
