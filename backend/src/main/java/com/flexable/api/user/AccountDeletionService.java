package com.flexable.api.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.budget.DailyBudgetRepository;
import com.flexable.api.budget.FixedExpensePostingRepository;
import com.flexable.api.budget.FixedExpenseRepository;
import com.flexable.api.budget.ProtectedItemRepository;
import com.flexable.api.budget.SettingsRepository;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.coin.CoinLedgerRepository;
import com.flexable.api.coin.CoinWalletRepository;
import com.flexable.api.outfit.UserOutfitRepository;
import com.flexable.api.referral.ReferralRepository;
import com.flexable.api.transaction.TransactionRepository;
import com.flexable.api.scheduled.ScheduledExpenseRepository;

/**
 * 계정과 모든 사용자 데이터를 즉시 영구 삭제한다. 거래가 카테고리를 참조하므로 거래부터 지운다.
 * 추천 기록은 내가 등록한 것만 지우고, 내가 초대한 사람의 기록은 초대한 사람만 비워 남긴다(다시 등록 못 하게).
 */
@Service
public class AccountDeletionService {

	private final TransactionRepository transactions;
	private final CategoryRepository categories;
	private final FixedExpenseRepository fixed;
	private final FixedExpensePostingRepository fixedPostings;
	private final ProtectedItemRepository protectedItems;
	private final SettingsRepository settings;
	private final DailyBudgetRepository dailyBudgets;
	private final CoinLedgerRepository coinLedger;
	private final CoinWalletRepository coinWallets;
	private final UserOutfitRepository userOutfits;
	private final ReferralRepository referrals;
	private final UserRepository users;
	private final ScheduledExpenseRepository scheduled;

	public AccountDeletionService(TransactionRepository transactions, CategoryRepository categories,
			FixedExpenseRepository fixed, FixedExpensePostingRepository fixedPostings,
			ProtectedItemRepository protectedItems, SettingsRepository settings, DailyBudgetRepository dailyBudgets,
			CoinLedgerRepository coinLedger, CoinWalletRepository coinWallets, UserOutfitRepository userOutfits,
			ReferralRepository referrals, UserRepository users, ScheduledExpenseRepository scheduled) {
		this.transactions = transactions;
		this.categories = categories;
		this.fixed = fixed;
		this.fixedPostings = fixedPostings;
		this.protectedItems = protectedItems;
		this.settings = settings;
		this.dailyBudgets = dailyBudgets;
		this.coinLedger = coinLedger;
		this.coinWallets = coinWallets;
		this.userOutfits = userOutfits;
		this.referrals = referrals;
		this.users = users;
		this.scheduled = scheduled;
	}

	@Transactional
	public void deleteAll(long userId) {
		// 고정지출 자동 기록(FixedExpensePoster)과 같은 순서로 설정 행을 먼저 잠근다.
		settings.findForUpdate(userId);
		transactions.deleteByUserId(userId);
		scheduled.deleteByUserId(userId);
		categories.deleteByUserId(userId);
		fixed.deleteByUserId(userId);
		fixedPostings.deleteByUserId(userId);
		protectedItems.deleteByUserId(userId);
		settings.deleteByUserId(userId);
		dailyBudgets.deleteByUserId(userId);
		coinLedger.deleteByUserId(userId);
		userOutfits.deleteByUserId(userId);
		coinWallets.deleteByUserId(userId);
		referrals.deleteByInviteeId(userId);
		referrals.clearInviter(userId);
		users.deleteById(userId);
	}
}
