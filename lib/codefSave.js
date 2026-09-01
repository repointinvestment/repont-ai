// lib/codefSave.js
// CODEF 응답에서 발급된 PDF(Base64)를 고객 파일함(Vercel Blob + customer_files 테이블)에 저장하는 공용 함수.
// 사용처: 각 문서 confirm 라우트(2차 확인 성공 시), 그리고 1차 요청 라우트(다건요청 팔로워로 쓰여서
// CODEF가 확인 단계 없이 1차 요청 응답에 바로 최종 데이터를 담아 주는 경우) 양쪽 모두.

import { sql } from '@/lib/db'
import { put } from '@vercel/blob'

export function saveIssuedPdfs(customerId, result, uploadedBy, fileLabel) {
  const items = Array.isArray(result.data) ? result.data : result.data ? [result.data] : []
  return Promise.all(
    items
      .filter((item) => item.resOriGinalData1)
      .map(async (item) => {
        try {
          const buffer = Buffer.from(item.resOriGinalData1, 'base64')
          const companyName = (item.resCompanyNm || item.resUserNm || fileLabel).replace(/[/\\?%*:|"<>]/g, '')
          const period = item.commStartDate && item.commEndDate ? `_${item.commStartDate}-${item.commEndDate}` : ''
          const fileName = `${fileLabel}_${companyName}${period}_${item.resIssueDate || Date.now()}.pdf`

          const blob = await put(`customers/${customerId}/${Date.now()}-${fileName}`, buffer, {
            access: 'private',
            contentType: 'application/pdf',
          })

          const [row] = await sql`
            INSERT INTO customer_files (customer_id, file_name, blob_url, size_bytes, uploaded_by)
            VALUES (${customerId}, ${fileName}, ${blob.pathname}, ${buffer.length}, ${uploadedBy || 'CODEF 자동수집'})
            RETURNING id, file_name
          `
          return {
            ...row,
            companyName: item.resCompanyNm || item.resUserNm || '',
            period: item.commStartDate && item.commEndDate ? `${item.commStartDate}-${item.commEndDate}` : '',
          }
        } catch (err) {
          console.error('CODEF PDF 파일함 저장 실패:', err)
          return null
        }
      })
  ).then((rows) => rows.filter(Boolean))
}
