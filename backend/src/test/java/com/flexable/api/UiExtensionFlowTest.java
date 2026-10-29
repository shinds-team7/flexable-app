package com.flexable.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
class UiExtensionFlowTest {
    @TestConfiguration static class Time {
        @Bean @Primary Clock testClock(){return Clock.fixed(Instant.parse("2026-10-30T03:00:00Z"),ZoneOffset.UTC);}
    }
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    static final String PASSWORD="UiTest1234";
    MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request,String token,String body){
        request.header("Authorization","Bearer "+token);
        if(body!=null)request.contentType(MediaType.APPLICATION_JSON).content(body);
        return request;
    }
    String signup() throws Exception {
        return read(mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"ui-"+UUID.randomUUID()+"@example.com\",\"password\":\""+PASSWORD+"\",\"agreeTerms\":true,\"agreePrivacy\":true}")).andExpect(status().isCreated()).andReturn(),"$.accessToken");
    }
    <T>T read(MvcResult result,String path)throws Exception{return JsonPath.read(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8),path);}
    List<Integer> ids(String token,String type)throws Exception{return read(mvc.perform(auth(get("/api/v1/categories?type="+type),token,null)).andReturn(),"$[*].id");}
    String planned(int category,String date){return "{\"amount\":25000,\"categoryId\":"+category+",\"title\":\"생일 선물\",\"date\":\""+date+"\"}";}
    @Test void plannedCrudIsOwnedAndDoesNotCreateTransactionsOrChangeBudget()throws Exception{
        String token=signup(),other=signup();int category=ids(token,"EXPENSE").get(0);
        mvc.perform(auth(put("/api/v1/budget/settings"),token,"{\"balance\":1000000,\"payday\":25,\"incomeAmount\":2000000,\"cardUnpaid\":0,\"fixedExpenses\":[],\"protectedItems\":[]}")).andExpect(status().isOk());
        Number before=read(mvc.perform(auth(get("/api/v1/budget/today"),token,null)).andReturn(),"$.todayAvailable");
        int id=read(mvc.perform(auth(post("/api/v1/scheduled-expenses"),token,planned(category,"2026-10-31"))).andExpect(status().isCreated()).andReturn(),"$.id");
        mvc.perform(auth(get("/api/v1/scheduled-expenses?from=2026-10-31&to=2026-10-31"),token,null)).andExpect(jsonPath("$.items",hasSize(1))).andExpect(jsonPath("$.items[0].category.name",is("식비")));
        mvc.perform(auth(get("/api/v1/scheduled-expenses?from=2026-10-31&to=2026-10-31"),other,null)).andExpect(jsonPath("$.items",hasSize(0)));
        mvc.perform(auth(put("/api/v1/scheduled-expenses/"+id),other,planned(category,"2026-11-01"))).andExpect(status().isNotFound());
        mvc.perform(auth(delete("/api/v1/scheduled-expenses/"+id),other,null)).andExpect(status().isNotFound());
        mvc.perform(auth(put("/api/v1/scheduled-expenses/"+id),token,planned(category,"2026-11-01"))).andExpect(status().isOk()).andExpect(jsonPath("$.date",is("2026-11-01")));
        mvc.perform(auth(get("/api/v1/transactions?from=2026-10-30&to=2026-11-01"),token,null)).andExpect(jsonPath("$.items",hasSize(0)));
        Number after=read(mvc.perform(auth(get("/api/v1/budget/today"),token,null)).andReturn(),"$.todayAvailable");
        assertThat(after.longValue()).isEqualTo(before.longValue());
        mvc.perform(auth(delete("/api/v1/scheduled-expenses/"+id),token,null)).andExpect(status().isNoContent());
        mvc.perform(auth(delete("/api/v1/scheduled-expenses/"+id),token,null)).andExpect(status().isNotFound());
    }
    @Test void plannedRejectsPastWrongOwnerWrongTypeAndInvalidAmounts()throws Exception{
        String token=signup(),other=signup();int category=ids(token,"EXPENSE").get(0);
        mvc.perform(auth(post("/api/v1/scheduled-expenses"),token,planned(category,"2026-10-30"))).andExpect(status().isBadRequest());
        mvc.perform(auth(post("/api/v1/scheduled-expenses"),token,planned(ids(other,"EXPENSE").get(0),"2026-10-31"))).andExpect(status().isBadRequest());
        mvc.perform(auth(post("/api/v1/scheduled-expenses"),token,planned(ids(token,"INCOME").get(0),"2026-10-31"))).andExpect(status().isBadRequest());
        mvc.perform(auth(post("/api/v1/scheduled-expenses"),token,planned(category,"2026-10-31").replace("25000","1000000000000"))).andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/v1/scheduled-expenses?from=2026-11-01&to=2026-10-31"),token,null)).andExpect(status().isBadRequest());
    }
    @Test void defaultDeletionAndLastCategoryDeletionPreserveActualAndPlannedRecords()throws Exception{
        String token=signup();List<Integer> initial=ids(token,"EXPENSE");int food=initial.get(0);
        int tx=read(mvc.perform(auth(post("/api/v1/transactions"),token,"{\"type\":\"EXPENSE\",\"amount\":12000,\"categoryId\":"+food+",\"title\":\"점심\"}")).andExpect(status().isCreated()).andReturn(),"$.id");
        mvc.perform(auth(post("/api/v1/scheduled-expenses"),token,planned(food,"2026-10-31"))).andExpect(status().isCreated());
        for(int id:initial)mvc.perform(auth(delete("/api/v1/categories/"+id),token,null)).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/v1/categories?type=EXPENSE"),token,null)).andExpect(jsonPath("$",hasSize(1))).andExpect(jsonPath("$[0].name",is("기타")));
        mvc.perform(auth(get("/api/v1/transactions/"+tx),token,null)).andExpect(jsonPath("$.category.name",is("기타"))).andExpect(jsonPath("$.amount",is(12000)));
        mvc.perform(auth(get("/api/v1/scheduled-expenses?from=2026-10-31&to=2026-10-31"),token,null)).andExpect(jsonPath("$.items[0].category.name",is("기타")));
        int owner=read(mvc.perform(auth(get("/api/v1/me"),token,null)).andReturn(),"$.id");
        mvc.perform(auth(delete("/api/v1/me"),token,"{\"password\":\""+PASSWORD+"\"}")).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from scheduled_expenses where user_id=?",Integer.class,owner)).isZero();
    }
    @Test void savedOrderPersistsAndRejectsOmissionsDuplicatesAndOtherUsers()throws Exception{
        String token=signup(),other=signup();List<Integer> before=ids(token,"EXPENSE");List<Integer> reversed=new ArrayList<>(before);Collections.reverse(reversed);
        String body="{\"type\":\"EXPENSE\",\"ids\":"+reversed+"}";
        mvc.perform(auth(put("/api/v1/categories/order"),token,body)).andExpect(status().isOk());assertThat(ids(token,"EXPENSE")).containsExactlyElementsOf(reversed);
        mvc.perform(auth(put("/api/v1/categories/order"),token,"{\"type\":\"EXPENSE\",\"ids\":["+before.get(0)+","+before.get(0)+"]}")).andExpect(status().isBadRequest());
        mvc.perform(auth(put("/api/v1/categories/order"),other,body)).andExpect(status().isBadRequest());
        assertThat(ids(token,"EXPENSE")).containsExactlyElementsOf(reversed);
        mvc.perform(auth(post("/api/v1/categories"),token,"{\"name\":\"마지막\",\"type\":\"EXPENSE\"}")).andExpect(status().isCreated());
        mvc.perform(auth(get("/api/v1/categories?type=EXPENSE"),token,null)).andExpect(jsonPath("$[8].name",is("마지막")));
    }
}
