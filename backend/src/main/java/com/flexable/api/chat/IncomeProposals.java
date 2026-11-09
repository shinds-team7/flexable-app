package com.flexable.api.chat;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import com.flexable.api.budget.BudgetService;
import com.flexable.api.category.Category;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.chat.ChatDtos.*;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.TxType;
import com.flexable.api.transaction.Transaction;
import com.flexable.api.transaction.TransactionRepository;

/** Validates model suggestions locally. Never sends individual records to the model or writes data. */
final class IncomeProposals {
    private static final long MAX = 999_999_999_999L;
    private final BudgetService budget;
    private final TransactionRepository transactions;
    private final CategoryRepository categories;
    private final ZoneId zone;

    IncomeProposals(BudgetService budget, TransactionRepository transactions, CategoryRepository categories, ZoneId zone) {
        this.budget = budget;
        this.transactions = transactions;
        this.categories = categories;
        this.zone = zone;
    }

    ChatResponse reply(long userId, LocalDate today, ChatModel.IncomeCall call) {
        if ("SETTINGS".equals(call.target())) return settings(userId, call);
        if (!"TRANSACTION".equals(call.target())) return ask("받은 돈을 기록할까요, 매달 받을 수입 설정을 바꿀까요?");
        List<Category> available = categories.findAllOrdered(userId, TxType.INCOME);
        if (available.isEmpty()) return ask("수입 카테고리를 먼저 만들어 주세요.");
        Category category = call.category() == null ? null : available.stream()
                .filter(c -> c.getName().equals(call.category().trim())).findFirst().orElse(null);
        if (call.category() != null && category == null) return ask("등록된 수입 카테고리 이름을 알려 주세요.");
        if (call.amount() != null && (call.amount() < 1 || call.amount() > MAX)) return ask("수입 금액을 원 단위로 알려 주세요.");
        LocalDate date = date(call.date());
        if (call.date() != null && (date == null || date.isAfter(today))) return ask("실제로 수입을 받은 날짜를 오늘까지의 날짜로 알려 주세요.");
        String title = call.title() == null ? null : call.title().trim();
        if (title != null && (title.isBlank() || title.length() > 40)) return ask("수입 제목을 40자 이내로 알려 주세요.");
        List<IncomeField> changes = new ArrayList<>();
        Transaction target = null;
        if ("UPDATE".equals(call.operation())) {
            LocalDate matchDate = date(call.matchDate());
            if ((call.matchDate() != null && (matchDate == null || matchDate.isAfter(today))) || (call.matchDate() == null
                    && call.matchAmount() == null && (call.matchTitle() == null || call.matchTitle().isBlank()))) {
                return ask("수정할 수입 기록의 기존 날짜·금액·제목을 알려 주세요.");
            }
            LocalDate from = matchDate == null ? today.minusDays(89) : matchDate;
            LocalDate to = matchDate == null ? today : matchDate;
            List<Transaction> matches = transactions.findInRange(userId, from.atStartOfDay(zone).toInstant(),
                    to.plusDays(1).atStartOfDay(zone).toInstant()).stream()
                    .filter(t -> t.getType() == TxType.INCOME)
                    .filter(t -> call.matchAmount() == null || t.getAmount() == call.matchAmount())
                    .filter(t -> call.matchTitle() == null || t.getTitle().equals(call.matchTitle().trim())).toList();
            if (matches.size() != 1) return ask(matches.isEmpty()
                    ? "일치하는 수입 기록을 찾지 못했어요. 기존 날짜·금액·제목을 다시 알려 주세요."
                    : "일치하는 수입 기록이 여러 개예요. 기존 날짜·금액·제목을 더 알려 주세요.");
            target = matches.getFirst();
            if (call.amount() != null) changes.add(IncomeField.AMOUNT);
            if (date != null) changes.add(IncomeField.DATE);
            if (title != null) changes.add(IncomeField.TITLE);
            if (category != null) changes.add(IncomeField.CATEGORY);
            if (changes.isEmpty()) return ask("수입 기록에서 무엇을 바꿀지 알려 주세요.");
            if (date == null) date = target.getOccurredAt().atZone(zone).toLocalDate();
            if (title == null) title = target.getTitle();
            if (category == null) {
                Long id = target.getCategoryId();
                category = available.stream().filter(c -> c.getId().equals(id)).findFirst().orElse(null);
            }
        } else if (!"CREATE".equals(call.operation())) return ask("수입을 새로 기록할까요, 기존 기록을 수정할까요?");
        if (category == null && target == null) category = available.getFirst();
        Long amount = call.amount();
        if (amount == null && target != null) amount = target.getAmount();
        if (amount == null || title == null || category == null) return ask("받은 수입의 금액과 제목을 함께 알려 주세요.");
        if (date == null) date = today;
        IncomeOperation operation = target == null ? IncomeOperation.CREATE : IncomeOperation.UPDATE;
        return new ChatResponse("아래 수입 기록을 확인해 주세요. 반영을 누르면 " + (target == null ? "등록돼요." : "수정돼요."),
                new ChatAction(ActionType.INCOME_TRANSACTION, null, null, null,
                        new IncomeTransactionProposal(operation, target == null ? null : target.getId(), title, date,
                                category.getId(), category.getName(), amount, changes), null));
    }

    private ChatResponse settings(long userId, ChatModel.IncomeCall call) {
        if ((call.amount() == null && call.payday() == null)
                || (call.amount() != null && (call.amount() < 0 || call.amount() > MAX))
                || (call.payday() != null && (call.payday() < 1 || call.payday() > 31))) {
            return ask("매달 받을 수입액이나 수입일(1~31일)을 알려 주세요.");
        }
        try {
            var current = budget.get(userId);
            long amount = call.amount() == null ? current.incomeAmount() : call.amount();
            int payday = call.payday() == null ? current.payday() : call.payday().intValue();
            return new ChatResponse("월 수입 설정을 확인해 주세요. 반영을 누르면 바뀌어요. 실제 받은 돈은 별도 수입 기록으로 남겨 주세요.",
                    new ChatAction(ActionType.INCOME_SETTINGS, null, null, null, null,
                            new IncomeSettingsProposal(amount, payday, current.incomeAmount(), current.payday())));
        } catch (ApiException e) {
            if (e.code() != ErrorCode.BUDGET_NOT_SET) throw e;
            return ask("초기 예산을 먼저 설정해 주세요. 설정을 마치면 월 수입액·수입일을 여기서 바꿀 수 있어요.");
        }
    }

    private static LocalDate date(String text) {
        try { return text == null ? null : LocalDate.parse(text); }
        catch (java.time.format.DateTimeParseException e) { return null; }
    }

    private static ChatResponse ask(String text) { return new ChatResponse(text, null); }
}
