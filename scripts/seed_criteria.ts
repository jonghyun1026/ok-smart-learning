/**
 * data/criteria.json -> Supabase `criteria` 테이블 동기화 스크립트 (멱등, upsert by item_no).
 *
 * criteria 테이블은 이미 19행이 시딩되어 있다. 이 스크립트는 향후 criteria.json이
 * 수정되었을 때(배점 변경, 항목 추가/수정 등) 재실행해서 DB를 동기화하는 용도다.
 *
 * 실행: npm run seed:criteria
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "node:path";
import criteriaData from "../data/criteria.json";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "환경변수 누락: .env.local 에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하세요."
  );
  process.exit(1);
}

type CriteriaItem = {
  no: string;
  name: string;
  type: "pass_fail" | "score";
  points: number | null;
  docs: string;
};

type CriteriaArea = {
  code: string;
  name: string;
  type: "pass_fail" | "score";
  items: CriteriaItem[];
};

async function main() {
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
  const areas = criteriaData.areas as CriteriaArea[];

  let sortOrder = 0;
  const rows = areas.flatMap((area) =>
    area.items.map((item) => ({
      item_no: item.no,
      area_code: area.code,
      area_name: area.name,
      item_name: item.name,
      item_type: item.type,
      max_points: item.points,
      doc_reference: item.docs,
      sort_order: sortOrder++,
    }))
  );

  console.log(`criteria.json에서 ${rows.length}개 항목을 읽었습니다. Supabase에 upsert합니다...`);

  const { data, error } = await supabase
    .from("criteria")
    .upsert(rows, { onConflict: "item_no" })
    .select();

  if (error) {
    console.error("criteria 동기화 실패:", error.message);
    process.exit(1);
  }

  const totalScorePoints = rows
    .filter((r) => r.item_type === "score")
    .reduce((sum, r) => sum + (r.max_points ?? 0), 0);

  console.log(`완료: ${data?.length ?? rows.length}행 upsert.`);
  console.log(`score 항목 배점 합계: ${totalScorePoints}점 (기대값: ${criteriaData.totalPoints}점)`);
  if (totalScorePoints !== criteriaData.totalPoints) {
    console.warn("경고: 배점 합계가 criteria.json의 totalPoints와 일치하지 않습니다!");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
