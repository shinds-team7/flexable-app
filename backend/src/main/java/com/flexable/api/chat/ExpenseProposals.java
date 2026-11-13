package com.flexable.api.chat;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import com.flexable.api.category.Category;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.chat.ChatDtos.*;
import com.flexable.api.common.TxType;
import com.flexable.api.transaction.Transaction;
import com.flexable.api.transaction.TransactionRepository;

/** 모델이 제안한 지출 기록(추가·수정)을 서버에서 검증한다. 저장은 하지 않고 개별 기록을 모델에 보내지도 않는다. */
final class ExpenseProposals {
    private static final long MAX = 999_999_999_999L;
    private final TransactionRepository transactions;
    private final CategoryRepository categories;
    private final ZoneId zone;

    ExpenseProposals(TransactionRepository transactions, CategoryRepository categories, ZoneId zone) {
        this.transactions = transactions;
        this.categories = categories;
        this.zone = zone;
    }

    ChatResponse reply(long userId, LocalDate today, ChatModel.ExpenseCall call) {
        List<Category> available = categories.findAllOrdered(userId, TxType.EXPENSE);
        if (available.isEmpty()) return ask("지출 카테고리를 먼저 만들어 주세요.");
        Category category = call.category() == null ? null : available.stream()
                .filter(c -> c.getName().equals(call.category().trim())).findFirst().orElse(null);
        if (call.category() != null && category == null) return ask("등록된 지출 카테고리 이름을 알려 주세요.");
        if (call.amount() != null && (call.amount() < 1 || call.amount() > MAX)) return ask("지출 금액을 원 단위로 알려 주세요.");
        LocalDate date = date(call.date());
        if (call.date() != null && (date == null || date.isAfter(today))) return ask("실제로 쓴 날짜를 오늘까지의 날짜로 알려 주세요.");
        String title = call.title() == null ? null : call.title().trim();
        if (title != null && (title.isBlank() || title.length() > 40)) return ask("지출 제목을 40자 이내로 알려 주세요.");
        List<IncomeField> changes = new ArrayList<>();
        Transaction target = null;
        if ("UPDATE".equals(call.operation())) {
            LocalDate matchDate = date(call.matchDate());
            if ((call.matchDate() != null && (matchDate == null || matchDate.isAfter(today))) || (call.matchDate() == null
                    && call.matchAmount() == null && (call.matchTitle() == null || call.matchTitle().isBlank()))) {
                return ask("수정할 지출 기록의 기존 날짜·금액·제목을 알려 주세요.");
            }
            LocalDate from = matchDate == null ? today.minusDays(89) : matchDate;
            LocalDate to = matchDate == null ? today : matchDate;
            List<Transaction> matches = transactions.findInRange(userId, from.atStartOfDay(zone).toInstant(),
                    to.plusDays(1).atStartOfDay(zone).toInstant()).stream()
                    .filter(t -> t.getType() == TxType.EXPENSE)
                    .filter(t -> call.matchAmount() == null || t.getAmount() == call.matchAmount())
                    .filter(t -> call.matchTitle() == null || t.getTitle().equals(call.matchTitle().trim())).toList();
            if (matches.size() != 1) return ask(matches.isEmpty()
                    ? "일치하는 지출 기록을 찾지 못했어요. 기존 날짜·금액·제목을 다시 알려 주세요."
                    : "일치하는 지출 기록이 여러 개예요. 기존 날짜·금액·제목을 더 알려 주세요.");
            target = matches.getFirst();
            if (call.amount() != null) changes.add(IncomeField.AMOUNT);
            if (date != null) changes.add(IncomeField.DATE);
            if (title != null) changes.add(IncomeField.TITLE);
            if (category != null) changes.add(IncomeField.CATEGORY);
            if (changes.isEmpty()) return ask("지출 기록에서 무엇을 바꿀지 알려 주세요.");
            if (date == null) date = target.getOccurredAt().atZone(zone).toLocalDate();
            if (title == null) title = target.getTitle();
            if (category == null) {
                Long id = target.getCategoryId();
                category = available.stream().filter(c -> c.getId().equals(id)).findFirst().orElse(null);
            }
        } else if (!"CREATE".equals(call.operation())) return ask("지출을 새로 기록할까요, 기존 기록을 수정할까요?");
        Long amount = call.amount();
        if (amount == null && target != null) amount = target.getAmount();
        if (amount == null || category == null) return ask("지출 금액과 카테고리를 함께 알려 주세요.");
        if (title == null) title = category.getName();
        if (date == null) date = today;
        IncomeOperation operation = target == null ? IncomeOperation.CREATE : IncomeOperation.UPDATE;
        return new ChatResponse("아래 지출 기록을 확인해 주세요. 반영을 누르면 " + (target == null ? "기록돼요." : "수정돼요."),
                new ChatAction(ActionType.EXPENSE_TRANSACTION, null, null, null, null, null,
                        new ExpenseTransactionProposal(operation, target == null ? null : target.getId(), title, date,
                                category.getId(), category.getName(), amount, changes)));
    }

    private static LocalDate date(String text) {
        try { return text == null ? null : LocalDate.parse(text); }
        catch (java.time.format.DateTimeParseException e) { return null; }
    }

    private static ChatResponse ask(String text) { return new ChatResponse(text, null); }
}
