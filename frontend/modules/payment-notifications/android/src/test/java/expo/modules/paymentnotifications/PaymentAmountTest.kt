package expo.modules.paymentnotifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PaymentAmountTest {
  @Test fun readsDomesticApproval() {
    assertEquals(12_300L, PaymentAmount.parse("신한카드 승인", "홍*동님\n12,300원 일시불\n11/08 12:30\n스타벅스"))
  }

  @Test fun readsLabelledAmount() {
    assertEquals(4_500L, PaymentAmount.parse("신한 SOL페이", "- 승인금액: 4,500원\n- 가맹점: GS25\n11/08 09:10 승인"))
  }

  @Test fun ignoresCancelForeignAndTotals() {
    assertNull(PaymentAmount.parse("신한카드 승인취소", "12,300원 일시불\n11/08 12:30\n스타벅스"))
    assertNull(PaymentAmount.parse("신한카드 해외승인", "12,300원\n11/08 12:30\nSHOP"))
    assertNull(PaymentAmount.parse("신한카드 승인", "누적 120,000원\n11/08 12:30\n스타벅스"))
  }

  @Test fun needsExactlyOneAmount() {
    assertNull(PaymentAmount.parse("신한카드 승인", "1,000원\n2,000원\n11/08 12:30\n가게"))
    assertNull(PaymentAmount.parse("신한카드 승인", "11/08 12:30\n가게"))
  }
}
