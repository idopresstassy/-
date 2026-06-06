import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface DonationInfo {
  id?: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  description: string;
  contact_email: string;
  closing_message: string;
  representative: string;
  legal_notice: string;
}

const DEFAULT_DONATION: DonationInfo = {
  bank_name: '카카오뱅크',
  account_number: '3333-29-8406357',
  account_holder: '홍기환',
  description:
    '무료로 제공되는 이 문학도서관은 개인의 노력으로 운영되고 있습니다.\n서버 유지비와 자료 정리를 위한 후원은 자발적으로만 받고 있으며, 후원금은 사이트 운영 및 한국문학 자료 보존에 사용됩니다.\n*후원은 자율적이며, 어떠한 대가나 특별 서비스가 제공되지 않습니다.',
  contact_email: 'tassy@naver.com',
  closing_message:
    '감사합니다.\n여러분의 관심이 한국문학의 지속적인 보존과 확산에 큰 힘이 됩니다.',
  representative: '이도출판 대표 홍기환',
  legal_notice:
    '※ 본 페이지의 후원금은 「기부금품법」상의 법정 기부금이 아닌, 운영자 개인에 대한 자발적 후원금으로 세제공제 대상이 아닙니다.',
};

export function useDonation() {
  const [donation, setDonation] = useState<DonationInfo>(DEFAULT_DONATION);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchDonation = useCallback(async () => {
    const { data, error } = await supabase
      .from('donation_info')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      // 테이블이 없거나 데이터가 없으면 기본값 사용
      setDonation(DEFAULT_DONATION);
    } else {
      setDonation({
        id: data.id,
        bank_name: data.bank_name ?? DEFAULT_DONATION.bank_name,
        account_number: data.account_number ?? DEFAULT_DONATION.account_number,
        account_holder: data.account_holder ?? DEFAULT_DONATION.account_holder,
        description: data.description ?? DEFAULT_DONATION.description,
        contact_email: data.contact_email ?? DEFAULT_DONATION.contact_email,
        closing_message: data.closing_message ?? DEFAULT_DONATION.closing_message,
        representative: data.representative ?? DEFAULT_DONATION.representative,
        legal_notice: data.legal_notice ?? DEFAULT_DONATION.legal_notice,
      });
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    fetchDonation();
  }, [fetchDonation]);

  const saveDonation = useCallback(
    async (info: DonationInfo) => {
      const row = {
        bank_name: info.bank_name,
        account_number: info.account_number,
        account_holder: info.account_holder,
        description: info.description,
        contact_email: info.contact_email,
        closing_message: info.closing_message,
        representative: info.representative,
        legal_notice: info.legal_notice,
      };

      if (info.id) {
        const { error } = await supabase
          .from('donation_info')
          .update(row)
          .eq('id', info.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('donation_info').insert(row);
        if (error) throw error;
      }

      await fetchDonation();
    },
    [fetchDonation]
  );

  return { donation, isLoaded, saveDonation, refetch: fetchDonation };
}
