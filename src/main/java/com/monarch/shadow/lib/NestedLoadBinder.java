package com.monarch.shadow.lib;

import java.util.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import org.joget.apps.app.model.AppDefinition;
import org.joget.apps.app.service.AppUtil;
import org.joget.apps.form.model.*;
import org.joget.apps.form.service.FormUtil;
import org.joget.workflow.util.WorkflowUtil;

/** Defers a child grid's multirow binder until expansion. Submission still loads the full baseline. */
public class NestedLoadBinder extends FormBinder implements FormLoadBinder, FormLoadMultiRowElementBinder, FormDataDeletableBinder {
    static final String SESSION_KEY = NestedLoadBinder.class.getName();
    static final long TTL = 30 * 60 * 1000L;
    final FormLoadBinder delegate;
    private final Map<FormData, String> tokens = new WeakHashMap<>();

    static class State {
        final long created = System.currentTimeMillis();
        final FormGridCustom grid;
        final FormData data;
        final String primaryKey, username;
        final AppDefinition app;
        FormRowSet baseline;
        State(FormGridCustom grid, FormData data, String primaryKey, String username, AppDefinition app) {
            this.grid = grid; this.data = data; this.primaryKey = primaryKey;
            this.username = username; this.app = app;
        }
    }

    NestedLoadBinder(FormLoadBinder delegate) { this.delegate = delegate; }
    protected HttpServletRequest request() { return WorkflowUtil.getHttpServletRequest(); }
    protected State newState(FormGridCustom grid, FormData data, String primaryKey) {
        return new State(grid, data, primaryKey, grid.nestedUsername(), AppUtil.getCurrentAppDefinition());
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> states(HttpSession session) {
        synchronized (session) {
            // Session attributes outlive an OSGi bundle update. Keep the boundary untyped:
            // a State with the same name from an older bundle is a different Java class.
            Object cached = session.getAttribute(SESSION_KEY);
            Map<String, Object> states = cached instanceof Map ? (Map<String, Object>) cached : null;
            if (states == null) { states = new LinkedHashMap<>(); session.setAttribute(SESSION_KEY, states); }
            return states;
        }
    }

    static State state(HttpSession session, String token) {
        Map<String, Object> states = states(session);
        synchronized (states) {
            Object value = states.get(token);
            if (value instanceof State && System.currentTimeMillis() - ((State) value).created <= TTL) return (State) value;
            states.remove(token);
            return null;
        }
    }

    @Override public FormRowSet load(Element element, String primaryKey, FormData data) {
        if (FormUtil.isFormSubmitted(element, data)) return delegate.load(element, primaryKey, data);
        HttpServletRequest request = request();
        if (request == null) return delegate.load(element, primaryKey, data);
        Map<String, Object> states = states(request.getSession());
        synchronized (states) {
            states.entrySet().removeIf(entry -> !(entry.getValue() instanceof State) ||
                    System.currentTimeMillis() - ((State) entry.getValue()).created > TTL);
            // Bound session memory while keeping multiple forms/tabs independent.
            while (states.size() >= 64) states.remove(states.keySet().iterator().next());
            String token = UUID.randomUUID().toString();
            states.put(token, newState((FormGridCustom) element, data, primaryKey));
            tokens.put(data, token);
        }
        FormRowSet empty = new FormRowSet(); empty.setMultiRow(true); return empty;
    }

    String token(FormData data) { return tokens.get(data); }
    @Override public String getFormId() { return delegate instanceof FormDataDeletableBinder ? ((FormDataDeletableBinder) delegate).getFormId() : ""; }
    @Override public String getTableName() { return delegate instanceof FormDataDeletableBinder ? ((FormDataDeletableBinder) delegate).getTableName() : ""; }
    @Override public Map<String, Object> getProperties() { return ((FormBinder) delegate).getProperties(); }
    @Override public void setProperties(Map<String, Object> properties) { ((FormBinder) delegate).setProperties(properties); }
    @Override public Element getElement() { return ((FormBinder) delegate).getElement(); }
    @Override public void setElement(Element element) { ((FormBinder) delegate).setElement(element); }
    @Override public void setProperty(String key, Object value) { ((FormBinder) delegate).setProperty(key, value); }
    @Override public Object getProperty(String key) { return ((FormBinder) delegate).getProperty(key); }
    @Override public String getPropertyString(String key) { return ((FormBinder) delegate).getPropertyString(key); }
    @Override public String getName() { return "NestedLoadBinder"; }
    @Override public String getVersion() { return "1.0"; }
    @Override public String getDescription() { return "Deferred nested grid load binder"; }
    @Override public String getLabel() { return getName(); }
    @Override public String getClassName() { return getClass().getName(); }
    @Override public String getPropertyOptions() { return ""; }
}
