package com.flexable.api.scheduled;

import java.time.Instant;
import java.time.LocalDate;
import jakarta.persistence.*;

@Entity
@Table(name = "scheduled_expenses")
public class ScheduledExpense {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false) private Long userId;
    @Column(name = "category_id", nullable = false) private Long categoryId;
    @Column(nullable = false) private long amount;
    @Column(nullable = false) private String title;
    @Column(name = "planned_date", nullable = false) private LocalDate date;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected ScheduledExpense() {}
    public ScheduledExpense(long userId, long categoryId, long amount, String title, LocalDate date, Instant now) {
        this.userId=userId; this.createdAt=now;
        update(categoryId, amount, title, date, now);
    }
    public void update(long categoryId, long amount, String title, LocalDate date, Instant now) {
        this.categoryId=categoryId; this.amount=amount; this.title=title; this.date=date; this.updatedAt=now;
    }
    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getCategoryId() { return categoryId; }
    public long getAmount() { return amount; }
    public String getTitle() { return title; }
    public LocalDate getDate() { return date; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
