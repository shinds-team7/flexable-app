package com.flexable.api.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.budget.FixedExpensePostingRepository;
import com.flexable.api.budget.FixedExpenseRepository;
import com.flexable.api.budget.ProtectedItemRepository;
import com.flexable.api.budget.SettingsRepository;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.transaction.TransactionRepository;

/** 계정과 모든 사용자 데이터를 즉시 영구 삭제한다. 거래가 카테고리를 참조하므로 거래부터 지운다. */
@Service
public class AccountDeletionService {

	private final TransactionRepository transactions;
	private final CategoryRepository categories;
	private final FixedExpenseRepository fixed;
	private final FixedExpensePostingRepository fixedPostings;
	private final ProtectedItemRepository protectedItems;
	private final SettingsRepository settings;
	private final UserRepository users;

	public AccountDeletionService(TransactionRepository transactions, CategoryRepository categories,
			FixedExpenseRepository fixed, FixedExpensePostingRepository fixedPostings,
			ProtectedItemRepository protectedItems, SettingsRepository settings, UserRepository users) {
		this.transactions = transactions;
		this.categories = categories;
		this.fixed = fixed;
		this.fixedPostings = fixedPostings;
		this.protectedItems = protectedItems;
		this.settings = settings;
		this.users = users;
	}

	@Transactional
	public void deleteAll(long userId) {
		// 고정지출 자동 기록(FixedExpensePoster)과 같은 순서로 설정 행을 먼저 잠근다.
		settings.findForUpdate(userId);
		transactions.deleteByUserId(userId);
		categories.deleteByUserId(userId);
		fixed.deleteByUserId(userId);
		fixedPostings.deleteByUserId(userId);
		protectedItems.deleteByUserId(userId);
		settings.deleteByUserId(userId);
		users.deleteById(userId);
	}
}
