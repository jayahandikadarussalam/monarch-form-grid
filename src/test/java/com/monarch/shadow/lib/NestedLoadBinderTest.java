package com.monarch.shadow.lib;

import java.io.*;
import java.lang.reflect.Proxy;
import java.lang.reflect.Constructor;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.*;
import javax.servlet.http.*;
import org.joget.apps.form.model.*;
import org.joget.apps.form.service.FormUtil;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class NestedLoadBinderTest {
    static class Grid extends FormGridCustom {
        @Override protected String nestedUsername() { return "tester"; }
        @Override public Boolean isAuthorize(FormData data) { return true; }
        @Override protected JSONObject getNestedRelation() {
            return new JSONObject().put("foreignKey", "parentId").put("sortWithButtons", "true").put("sortField", "sort");
        }
    }
    static class Binder extends FormBinder implements FormLoadBinder, FormLoadMultiRowElementBinder {
        int calls;
        final FormRowSet rows = new FormRowSet();
        Binder() { rows.setMultiRow(true); }
        public FormRowSet load(Element e,String key,FormData data) { calls++; return rows; }
        public String getName() { return "test"; }
        public String getVersion() { return "1"; }
        public String getDescription() { return ""; }
        public String getLabel() { return "test"; }
        public String getClassName() { return getClass().getName(); }
        public String getPropertyOptions() { return ""; }
    }
    static FormRow row(String id,String parent) {
        FormRow row=new FormRow();row.setId(id);row.setProperty("parentId",parent);row.setProperty("name",id);return row;
    }
    static class Http {
        final Map<String,Object> attributes=new HashMap<>();
        final Map<String,String> params=new HashMap<>();
        String method="POST";int status=200;
        final StringWriter body=new StringWriter();
        final HttpSession session=(HttpSession) Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{HttpSession.class},(p,m,a)->{
            if(m.getName().equals("getAttribute"))return attributes.get(a[0]);
            if(m.getName().equals("setAttribute")){attributes.put((String)a[0],a[1]);return null;}
            return null;
        });
        final HttpServletRequest request=(HttpServletRequest) Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{HttpServletRequest.class},(p,m,a)->{
            if(m.getName().equals("getSession"))return session;
            if(m.getName().equals("getParameter"))return params.get(a[0]);
            if(m.getName().equals("getMethod"))return method;
            return null;
        });
        final HttpServletResponse response=(HttpServletResponse) Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{HttpServletResponse.class},(p,m,a)->{
            if(m.getName().equals("getWriter"))return new PrintWriter(body);
            if(m.getName().equals("sendError")){status=(Integer)a[0];return null;}
            return null;
        });
    }
    @Test public void initialLoadDoesNotCallBinderButSubmissionLoadsTheBaseline() {
        Grid grid=new Grid();grid.setProperty("id","child");
        Form form=new Form();form.setProperty("id","main");grid.setParent(form);
        Binder actual=new Binder();actual.rows.add(row("old","p1"));
        Http http=new Http();
        NestedLoadBinder deferred=new NestedLoadBinder(actual) {
            @Override protected HttpServletRequest request(){return http.request;}
        };
        FormData initial=new FormData();
        assertTrue(deferred.load(grid,"owner",initial).isEmpty());assertEquals(0,actual.calls);
        assertNotNull(deferred.token(initial));
        FormData posted=new FormData();posted.addRequestParameterValues(FormUtil.getElementParameterName(form)+"_SUBMITTED",new String[]{"true"});
        assertEquals(1,deferred.load(grid,"owner",posted).size());assertEquals(1,actual.calls);
    }
    @Test public void unopenedRowsSurviveWhileAnOpenedBranchCanBeDeletedCompletely() {
        Grid grid=new Grid();FormRowSet baseline=new FormRowSet(),submitted=new FormRowSet();
        baseline.add(row("a","p1"));baseline.add(row("b","p2"));
        FormRowSet merged=grid.mergeUnloadedRows(baseline,submitted,"parentId",Collections.singleton("p1"));
        assertEquals(1,merged.size());assertEquals("b",merged.get(0).getId());
        assertEquals("b",new JSONObject(merged.get(0).getProperty("jsonrow")).getString("id"));
        assertEquals(2,grid.mergeUnloadedRows(baseline,submitted,"parentId",Collections.emptySet()).size());
        submitted.add(row("new","p1"));
        merged=grid.mergeUnloadedRows(baseline,submitted,"parentId",Collections.singleton("p1"));
        assertEquals(2,merged.size());assertEquals("new",merged.get(0).getId());assertEquals("b",merged.get(1).getId());
    }
    @Test public void mergingDoesNotDuplicateAnEditedExistingRow() {
        Grid grid=new Grid();FormRowSet baseline=new FormRowSet(),submitted=new FormRowSet();
        baseline.add(row("a","p1"));FormRow edit=row("a","p1");edit.setProperty("name","Edited");submitted.add(edit);
        FormRowSet merged=grid.mergeUnloadedRows(baseline,submitted,"parentId",Collections.emptySet());
        assertEquals(1,merged.size());assertEquals("Edited",merged.get(0).getProperty("name"));
    }
    @Test public void submittedEmptyGridDeletesOnlyAcknowledgedParentPartition() {
        Grid grid=new Grid();grid.setProperty("id","child");
        Form form=new Form();form.setProperty("id","main");grid.setParent(form);
        final FormRowSet baseline=new FormRowSet();baseline.setMultiRow(true);
        baseline.add(row("opened","p1"));FormRow unopened=row("unopened","p2");unopened.setProperty("sort","17");baseline.add(unopened);
        FormData posted=new FormData() {
            @Override public FormRowSet getLoadBinderData(Element element) { return baseline; }
        };
        posted.addRequestParameterValues(FormUtil.getElementParameterName(form)+"_SUBMITTED",new String[]{"true"});
        String param=FormUtil.getElementParameterName(grid);
        posted.addRequestParameterValues(param+"_jsonrow",new String[]{""});
        posted.addRequestParameterValues(param+"_nested_loaded",new String[]{"[\"p1\"]"});
        FormRowSet result=grid.getRows(posted);
        assertEquals(1,result.size());assertEquals("unopened",result.get(0).getId());
        assertEquals("17",grid.convertJsonToFormRowSet(result).get(0).getProperty("sort"));
    }
    @Test public void serviceUsesSessionBoundBinderAndReturnsOnlyTheRequestedParentsRows() throws Exception {
        Grid grid=new Grid();Binder binder=new Binder();
        FormRow second=row("second","p1");second.setProperty("sort","2");
        FormRow first=row("first","p1");first.setProperty("sort","1");
        binder.rows.add(second);binder.rows.add(row("other","p2"));binder.rows.add(first);
        grid.nestedLoadBinder=new NestedLoadBinder(binder);
        Http http=new Http();http.params.put("token","test-token");http.params.put("parentKey","p1");
        NestedLoadBinder.states(http.session).put("test-token",new NestedLoadBinder.State(grid,new FormData(),"owner","tester",null));
        grid.webService(http.request,http.response);assertEquals(200,http.status);assertEquals(1,binder.calls);
        assertEquals(3,new JSONObject(http.body.toString()).getInt("total"));
        JSONArray rows=new JSONObject(http.body.toString()).getJSONArray("rows");
        assertEquals(2,rows.length());assertEquals("first",rows.getJSONObject(0).getString("id"));
        http.body.getBuffer().setLength(0);http.params.put("parentKey","p2");
        grid.webService(http.request,http.response);assertEquals(1,binder.calls);
        assertEquals("other",new JSONObject(http.body.toString()).getJSONArray("rows").getJSONObject(0).getString("id"));
    }
    @Test public void unknownTokensAndOtherUsersCannotInvokeTheBinder() throws Exception {
        Grid grid=new Grid();Binder binder=new Binder();grid.nestedLoadBinder=new NestedLoadBinder(binder);
        Http http=new Http();http.params.put("token","missing");grid.webService(http.request,http.response);assertEquals(410,http.status);
        http.status=200;http.params.put("token","wrong-user");
        NestedLoadBinder.states(http.session).put("wrong-user",new NestedLoadBinder.State(grid,new FormData(),"owner","someone-else",null));
        grid.webService(http.request,http.response);assertEquals(403,http.status);assertEquals(0,binder.calls);
        http.method="GET";grid.webService(http.request,http.response);assertEquals(405,http.status);
    }

    private Object stateFromPreviousBundle() throws Exception {
        URL classes = NestedLoadBinder.class.getProtectionDomain().getCodeSource().getLocation();
        try (URLClassLoader oldBundle = new URLClassLoader(new URL[]{classes}, getClass().getClassLoader()) {
            @Override protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
                synchronized (getClassLoadingLock(name)) {
                    if (name.startsWith("com.monarch.shadow.lib.")) {
                        Class<?> type = findLoadedClass(name);
                        if (type == null) type = findClass(name);
                        if (resolve) resolveClass(type);
                        return type;
                    }
                    return super.loadClass(name, resolve);
                }
            }
        }) {
            Class<?> oldState = oldBundle.loadClass(NestedLoadBinder.State.class.getName());
            Constructor<?> constructor = oldState.getDeclaredConstructors()[0];
            constructor.setAccessible(true);
            Object value = constructor.newInstance(null, new FormData(), "owner", "tester", null);
            assertEquals(NestedLoadBinder.State.class.getName(), value.getClass().getName());
            assertNotSame(NestedLoadBinder.State.class.getClassLoader(), value.getClass().getClassLoader());
            assertFalse(value instanceof NestedLoadBinder.State);
            return value;
        }
    }

    @Test public void bundleUpdateDiscardsForeignStatesWithoutBreakingNewFormLoads() throws Exception {
        Http http = new Http();
        Map<String, Object> sessionStates = NestedLoadBinder.states(http.session);
        sessionStates.put("old-token", stateFromPreviousBundle());
        Grid grid = new Grid(); grid.setProperty("id", "child");
        Binder actual = new Binder();
        NestedLoadBinder deferred = new NestedLoadBinder(actual) {
            @Override protected HttpServletRequest request() { return http.request; }
        };
        FormData initial = new FormData();
        assertTrue(deferred.load(grid, "owner", initial).isEmpty());
        assertFalse(sessionStates.containsKey("old-token"));
        assertEquals(0, actual.calls);
        assertNotNull(NestedLoadBinder.state(http.session, deferred.token(initial)));
    }

    @Test public void oldPageTokensReturnGoneAfterBundleUpdateWithoutCallingTheirBinder() throws Exception {
        Http http = new Http();
        NestedLoadBinder.states(http.session).put("old-token", stateFromPreviousBundle());
        Grid grid = new Grid(); Binder actual = new Binder(); grid.nestedLoadBinder = new NestedLoadBinder(actual);
        http.params.put("token", "old-token"); http.params.put("parentKey", "p1");
        grid.webService(http.request, http.response);
        assertEquals(410, http.status); assertEquals(0, actual.calls);
        assertFalse(NestedLoadBinder.states(http.session).containsKey("old-token"));
    }

    @Test public void incompatibleSessionContainerIsRecreated() {
        Http http = new Http(); http.attributes.put(NestedLoadBinder.SESSION_KEY, "invalid old container");
        assertTrue(NestedLoadBinder.states(http.session).isEmpty());
    }
}
