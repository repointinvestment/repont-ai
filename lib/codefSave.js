// lib/codefSave.js
// CODEF 응답에서 발급된 PDF(Base64)를 고객 파일함(Vercel Blob + customer_files 테이블)에 저장하는 공용 함수.
// 사용처: 각 문서 confirm 라우트(2차 확인 성공 시), 그리고 1차 요청 라우트(다건요청 팔로워로 쓰여서
// CODEF가 확인 단계 없이 1차 요청 응답에 바로 최종 데이터를 담아 주는 경우) 양쪽 모두.

import { sql } from '@/lib/db'
import { put, del } from '@vercel/blob'

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

          // 같은 서류(종류+상호+과세기간)를 다시 발급받으면 예전 파일은 지우고 최신으로 덮음 — 발급일만 다른 중복이 쌓이지 않게.
          // 오래된 중복이 여러 개 쌓여있던 테스트 고객 기준으로 순차 삭제(1개씩 await)가 눈에 띄게 느려서 병렬로 처리.
          const dupPrefix = `${fileLabel}_${companyName}${period}_`
          try {
            const olds = await sql`
              SELECT id, blob_url FROM customer_files
              WHERE customer_id = ${customerId} AND file_name LIKE ${dupPrefix + '%'} AND file_name LIKE '%.pdf'
            `
            await Promise.all(olds.map(async (o) => {
              try { if (o.blob_url) await del(o.blob_url) } catch (e) { console.warn('구 파일 blob 삭제 실패(무시):', e.message) }
              await sql`DELETE FROM customer_files WHERE id = ${o.id}`
            }))
          } catch (e) {
            console.warn('중복 서류 정리 실패(무시):', e.message)
          }

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
