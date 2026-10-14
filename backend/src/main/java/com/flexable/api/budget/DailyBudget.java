package com.flexable.api.budget;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 그날의 하루 예산(그날 마지막으로 계산한 값). 캐릭터 단계 점수에서 그날 예산을 지켰는지 판단한다. */
@Entity
@Table(name = "daily_budgets")
public class DailyBudget {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "budget_date", nullable = false)
	private LocalDate date;

	@Column(name = "daily_budget", nullable = false)
	private long dailyBudget;

	protected DailyBudget() {
	}

	public LocalDate getDate() {
		return date;
	}

	public long getDailyBudget() {
		return dailyBudget;
	}
}
