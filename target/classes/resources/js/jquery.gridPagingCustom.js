(function( $ ){
    function normalize(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function matches(row, query) {
        query = normalize(query);
        if (!query) return true;
        var values = [];
        var data = {};
        try { data = JSON.parse(row.children('td').children('textarea:not(.formgrid-editor)').first().val() || '{}'); } catch (ignored) {}
        row.children('td').each(function() {
            var cell = $(this);
            if (cell.css('display') === 'none') return;
            cell.find('.grid-cell[column_key]').each(function() {
                var field = $(this), display = field.clone();
                display.find('input,select,textarea,script,style,.tablesaw-cell-label,.formgrid-editable-filenames').remove();
                values.push(display.text());
                field.find('.formgrid-editor').each(function() {
                    var editor = $(this), column = editor.data('column') || {}, value = editor.val();
                    // Nested editors write to canonical JSON without rebuilding the source controls.
                    if (Object.prototype.hasOwnProperty.call(data, column.id)) value = data[column.id];
                    if (data._decryptedDataMap && data._decryptedDataMap[column.id] !== undefined) value = data._decryptedDataMap[column.id];
                    if (editor.is('select')) {
                        var selected = String(value == null ? '' : value).split(';');
                        editor.find('option').each(function() {
                            if (selected.indexOf(this.value) !== -1) values.push($(this).text());
                        });
                    } else if (!editor.is(':checkbox,:radio') || editor.is(':checked')) values.push(value);
                });
            });
        });
        return normalize(values.join(' ')).indexOf(query) !== -1;
    }

    // Shared by canonical grids and the related-record views of nested grids.
    $.formGridSearch = {matches: matches};

    var defaults = {
        size : 10,
        threshold : 10
    };

    var methods = {
        init: function(args) {
            return this.each(function(){
                var options = $.extend(true, {}, defaults, args);

                var pageSize = Number(options.customSize);
                if (isFinite(pageSize) && pageSize >= 1) {
                    options.size = Math.floor(pageSize);
                }

                var thisObj = $(this);
                $(thisObj).children("table").data("pagingOptions", options);

                methods.refresh.call(thisObj);

                thisObj.off('change.gridPagingCustom').on('change.gridPagingCustom', function(){
                    methods.refresh.call(thisObj);
                });

                var search = thisObj.children('.formgrid-search').find('.formgrid-search-input');
                search.off('.gridPagingCustom').on('input.gridPagingCustom search.gridPagingCustom change.gridPagingCustom', function(event) {
                    event.stopPropagation();
                    thisObj.children('.pg-navigator').find('.pg-current').attr('rel', 1);
                    methods.refresh.call(thisObj);
                }).on('keydown.gridPagingCustom', function(event) {
                    if (event.key === 'Enter') event.preventDefault();
                });
                thisObj.off('formgrid:rowupdated.gridPagingCustom').on('formgrid:rowupdated.gridPagingCustom', function() {
                    if (search.length) methods.refresh.call(thisObj);
                });

                if (options.dataSorting) {
                    methods.enableSorting.call(thisObj);
                }
            });
        },

        enableSorting: function() {
            var thisObj = $(this);
            var $table = $(thisObj).children("table");

            var $headers = $table.find("th").filter(function() {
                return $(this).attr("id") != undefined;
            });
            $headers.css("cursor", "pointer");

            $headers.off("click.gridPagingCustom").on("click.gridPagingCustom", function(){
                var $this = $(this);
                var th_index = $this.index();
                var sort_dir = "asc";

                if ($this.data("sort-dir")) {
                    sort_dir = $this.data("sort-dir") === "asc" ? "desc" : "asc";
                }

                var column = [];
                var sortMethod = function(a, b) {
                    // to handle number sorting
                    if (isNaN(a) || isNaN(b)) {
                        a = a.toLowerCase();
                        b = b.toLowerCase();
                        if (a < b) return -1;
                        if (a > b) return +1;
                    } else {
                        return parseFloat(a) - parseFloat(b);
                    }
                    return 0;
                };
                var trs = $table.children("tbody").children("tr.grid-row");

                // Extract the data for the column that needs to be sorted and pair it up
                // with the TR itself into a tuple
                trs.each(function(index,tr) {
                    var $e = $(tr).children().eq(th_index);
                    var order_by = $e.find(".grid-cell").text();
                    column.push([order_by, tr]);
                });

                // Sort by the data-order-by value
                column.sort(function(a, b) { return sortMethod(a[0], b[0]); });
                if (sort_dir != "asc") {
                    column.reverse();
                }

                // Replace the content of tbody with the sorted rows. Strangely (and
                // conveniently!) enough, .append accomplishes this for us.
                trs = $.map(column, function(kv) { return kv[1]; });
                $table.children("tbody").append(trs);

                // Reset siblings
                $table.find("th").data("sort-dir", null).removeClass("sorting-desc sorting-asc");
                $this.data("sort-dir", sort_dir).addClass("sorting-"+sort_dir);

                methods.refresh.call(thisObj);

                $(thisObj).formGridCustom("refreshIndex");
                thisObj.triggerHandler('formgrid:sorted');
            });
        },

        refresh: function() {
            var thisObj = $(this);

            methods.filter.call(thisObj);

            var currentPage = 1;

            if (thisObj.children('.pg-navigator').find('.pg-current').length > 0) {
                currentPage = thisObj.children('.pg-navigator').find('.pg-current').attr('rel');
            }

            methods.navigator.call(thisObj);
            methods.showPage.call(thisObj, currentPage);
        },

        filter: function() {
            var grid = $(this), toolbar = grid.children('.formgrid-search');
            if (!toolbar.length) return;
            var query = normalize(toolbar.find('.formgrid-search-input').val());
            var rows = grid.children('table').children('tbody').children('tr.grid-row');
            rows.each(function() {
                var row = $(this), hidden = !matches(row, query);
                row.toggleClass('fg-search-hidden', hidden);
                if (hidden) row.find('.grid-checkbox-children').prop('checked', false);
            });
            var available = rows.not('.fg-hidden,.fg-search-hidden');
            toolbar.find('.formgrid-search-empty').prop('hidden', !query || available.length > 0);
            if (grid.data('selected_rows') !== undefined) {
                var boxes = available.find('.grid-checkbox-children:not(:disabled)'), checked = boxes.filter(':checked');
                grid.data('selected_rows', checked.map(function() { return $(this).closest('td')[0]; }).get());
                grid.children('.delete_btn').toggle(checked.length > 0);
                grid.children('table').find('.grid-checkbox-parent').prop('checked', boxes.length > 0 && checked.length === boxes.length);
            }
        },

        navigator: function() {
            var thisObj = $(this);

            var table = $(thisObj).children("table");
            var options = $(table).data("pagingOptions");
            var size = table.children('tbody').children('tr.grid-row').not('.fg-hidden,.fg-search-hidden').length;

            if (thisObj.children('.pg-navigator').length > 0) {
                thisObj.children('.pg-navigator').remove();
            }

            if (size <= options.threshold) return;
            var pages = Math.max(1, Math.ceil(size / options.size));
            var pager = $('<p class="pg-navigator" role="group" aria-label="Table pagination"></p>');
            function control(label, className, title, target) {
                return $('<button type="button">').addClass(className).text(label).attr('aria-label', title)
                    .on('click.gridPagingCustom', function() {
                        var current = Number(table.data('pagingPage')) || 1;
                        methods.showPage.call(thisObj, target(current));
                    });
            }
            pager.append(control('«', 'pg-first', 'First page', function() { return 1; }),
                control('‹', 'pg-prev', 'Previous page', function(page) { return page - 1; }),
                $('<span class="pg-current" role="status" aria-live="polite">'),
                control('›', 'pg-next', 'Next page', function(page) { return page + 1; }),
                control('»', 'pg-last', 'Last page', function() { return pages; }));
            table.after(pager);
        },

        showPage: function(page) {
            var thisObj = $(this);

            var table = $(thisObj).children("table");
            var options = table.data("pagingOptions");
            var allRows = table.children('tbody').children('tr.grid-row');
            allRows.filter('.fg-hidden,.fg-search-hidden').removeClass('pg-tr-show').addClass('pg-tr-hide').hide();
            var candidateRows = allRows.not('.fg-hidden,.fg-search-hidden');
            var pageSize = candidateRows.length <= options.threshold ? Math.max(options.threshold, 1) : options.size;
            var pages = Math.max(1, Math.ceil(candidateRows.length / pageSize));
            page = Math.max(1, Math.min(Number(page) || 1, pages));
            table.data('pagingPage', page);
            var start = pageSize * (page - 1);
            var end = pageSize * page;

            candidateRows.each(function(i) {
                if (i >= start && i < end) {
                    $(this).addClass("pg-tr-show").removeClass("pg-tr-hide").show();
                } else {
                    $(this).removeClass("pg-tr-show").addClass("pg-tr-hide").hide();
                }
            });


            var pager = thisObj.children('.pg-navigator');
            pager.find('.pg-current').attr('rel', page).text(page + ' / ' + pages);
            pager.find('.pg-first,.pg-prev').prop('disabled', page === 1);
            pager.find('.pg-next,.pg-last').prop('disabled', page === pages);
            thisObj.triggerHandler('formgrid:pagechanged');
        }
    };

    $.fn.gridPagingCustom = function( method ) {

        if ( methods[method] ) {
            return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.listgrid' );
        }

    };
})( jQuery );
