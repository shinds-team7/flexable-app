package com.flexable.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** showInactive: 꺼 둔(active=false) 상점 상품도 목록·구매에 보여 준다. 로컬·테스트만 true. */
@ConfigurationProperties("app.outfits")
public record OutfitProperties(boolean showInactive) {
}
