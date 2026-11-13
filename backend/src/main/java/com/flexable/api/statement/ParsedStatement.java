package com.flexable.api.statement;

import java.time.LocalDate;
import java.util.List;

public record ParsedStatement(String bank, LocalDate from, LocalDate to, List<StatementRow> rows) {
}
