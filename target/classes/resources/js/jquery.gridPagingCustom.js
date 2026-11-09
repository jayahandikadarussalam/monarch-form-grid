(function( $ ){
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

                $(thisObj).change(function(){
                    methods.refresh.call(thisObj);
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

            var currentPage = 1;

            if ($(thisObj).find(".pg-navigator .pg-current").length > 0) {
                currentPage = $(thisObj).find(".pg-navigator .pg-current").attr("rel");
            }

            methods.navigator.call(thisObj);
            methods.showPage.call(thisObj, currentPage);
        },

        navigator: function() {
            var thisObj = $(this);

            var table = $(thisObj).children("table");
            var options = $(table).data("pagingOptions");
            var size = $(table).find("tr.grid-row").not(".fg-hidden").length;

            if ($(thisObj).find(".pg-navigator").length > 0) {
                $(thisObj).find(".pg-navigator").remove();
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
            var candidateRows = table.find("tr.grid-row").not(".fg-hidden");
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
