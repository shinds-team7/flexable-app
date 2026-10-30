package com.flexable.api.scheduled;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.flexable.api.auth.CurrentUser;
import com.flexable.api.category.CategoryDtos.CategoryRef;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.category.CategoryService;
import com.flexable.api.common.*;
import com.flexable.api.config.AppProperties;

@RestController
@RequestMapping("/api/v1/scheduled-expenses")
public class ScheduledExpenseController {
    public record Input(@NotNull @Min(1) @Max(999999999999L) Long amount,
            @NotNull Long categoryId, @NotBlank @Size(max=40) String title, @NotNull LocalDate date) {}
    public record Item(Long id, long amount, Long categoryId, CategoryRef category, String title,
            LocalDate date, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    public record Items(List<Item> items) {}
    private final ScheduledExpenseRepository expenses;
    private final CategoryRepository categories;
    private final CategoryService categoryService;
    private final Clock clock;
    private final AppProperties props;
    public ScheduledExpenseController(ScheduledExpenseRepository expenses, CategoryRepository categories,
            CategoryService categoryService, Clock clock, AppProperties props) {
        this.expenses=expenses; this.categories=categories; this.categoryService=categoryService;
        this.clock=clock; this.props=props;
    }
    @GetMapping @Transactional(readOnly=true)
    public Items list(@AuthenticationPrincipal Jwt jwt, @RequestParam LocalDate from, @RequestParam LocalDate to) {
        DateRange.of(from,to);
        return new Items(expenses.findByUserIdAndDateBetweenOrderByDateAscIdAsc(CurrentUser.id(jwt),from,to)
            .stream().map(this::item).toList());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Item create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Input body) {
        long userId=CurrentUser.id(jwt);
        future(body.date());
        categoryService.requireForType(userId,body.categoryId(),TxType.EXPENSE);
        return item(expenses.save(new ScheduledExpense(userId,body.categoryId(),body.amount(),body.title().trim(),body.date(),clock.instant())));
    }
    @PutMapping("/{id}") @Transactional
    public Item update(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody Input body) {
        long userId=CurrentUser.id(jwt);
        ScheduledExpense expense=get(userId,id);
        if (!body.date().equals(expense.getDate())) future(body.date());
        categoryService.requireForType(userId,body.categoryId(),TxType.EXPENSE);
        expense.update(body.categoryId(),body.amount(),body.title().trim(),body.date(),clock.instant());
        return item(expense);
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void delete(@AuthenticationPrincipal Jwt jwt,@PathVariable long id) {
        expenses.delete(get(CurrentUser.id(jwt),id));
    }
    private ScheduledExpense get(long userId,long id) {
        return expenses.findByIdAndUserId(id,userId).orElseThrow(()->new ApiException(ErrorCode.NOT_FOUND));
    }
    private void future(LocalDate date) {
        if (!date.isAfter(LocalDate.now(clock.withZone(props.zoneId())))) throw ApiException.invalid("date","내일부터의 날짜를 선택해 주세요");
    }
    private Item item(ScheduledExpense e) {
        CategoryRef category=categories.findByIdAndUserId(e.getCategoryId(),e.getUserId()).map(CategoryRef::of).orElse(null);
        return new Item(e.getId(),e.getAmount(),e.getCategoryId(),category,e.getTitle(),e.getDate(),
            e.getCreatedAt().atZone(props.zoneId()).toOffsetDateTime(),e.getUpdatedAt().atZone(props.zoneId()).toOffsetDateTime());
    }
}
