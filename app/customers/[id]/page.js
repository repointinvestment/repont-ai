'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const OWNERSHIP_OPTIONS = ['자가', '임대', '가족소유'];
const STATUS_OPTIONS = ['상담중', '서류준비', '심사중', '완료'];

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/customers/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error();
        const c = data.customer;
        setForm({
          businessName: c.business_name || '',
          businessType: c.business_type || '',
          ownerName: c.owner_name || '',
          phone: c.phone || '',
          email: c.email || '',
          industry: c.industry || '',
          bizRegNumber: c.biz_reg_number || '',
          establishDate: c.establish_date || '',
          openDate: c.open_date || '',
          revenueAmount: c.revenue_amount || '',
          creditNice: c.credit_nice || '',
          creditKcb: c.credit_kcb || '',
          address: c.address || '',
          addressOwnership: c.address_ownership || '자가',
          residenceAddress: c.residence_address || '',
          residenceOwnership: c.residence_ownership || '자가',
          loanStatus: c.loan_status || '',
          memo: c.memo || '',
          status: c.status || '상담중',
        });
      } catch (err) {
        setError('고객 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      router.push('/customers');
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('정말 이 고객을 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${params.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      router.push('/customers');
    } catch (err) {
      setError('삭제 중 오류가 발생했습니다.');
      setDeleting(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #D3D1C7',
    fontSize: 14,
    marginTop: 6,
    boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 13, color: '#5F5E5A' };
  const sectionTitle = { fontSize: 15, fontWeight: 500, margin: '24px 0 4px' };
  const row = { display: 'flex', gap: 12 };
  const half = { flex: 1 };

  if (loading) {
