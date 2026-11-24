import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const prompt = `이 혈액검사지 이미지에서 검사일자와 검사항목별 결과, 참고치를 추출해 JSON으로만 응답해줘.
형식:
{
  "exam_date": "YYYY-MM-DD (없으면 빈 문자열)",
  "items": [
    { "name": "검사항목명", "ref": "참고치(예: 0~33, <150, >60)", "value": "결과값" }
  ]
}
설명이나 마크다운 코드블록 없이 순수 JSON만 반환해.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "이미지 분석 실패" }, { status: 500 });
  }
}