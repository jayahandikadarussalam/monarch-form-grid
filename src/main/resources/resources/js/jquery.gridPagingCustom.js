(function( $ ){
    var defaults = {
        size : 20
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

            // Joget keeps the navigator's spacing even when there is only one page.
            $(table).after("<p class=\"pg-navigator\"></p>");

            var pages = 1;
            if (size > options.size) {
                pages = Math.ceil(size / options.size);
            } else {
                return;
            }

            var pagerHtml = '<span class="pg-prev"> &#171; </span> | ';
            for (var page = 1; page <= pages; page++) {
                pagerHtml += '<span class="pg-normal" rel="'+page+'">' + page + '</span> | ';
            }
            pagerHtml += '<span class="pg-next"> &#187; </span>';

            $(thisObj).find(".pg-navigator").html(pagerHtml);

            $(thisObj).find(".pg-navigator .pg-prev").click(function(){
                var prev = $(thisObj).find(".pg-navigator .pg-current").prev();
                if ($(prev).hasClass("pg-normal")) {
                    methods.showPage.call(thisObj, $(prev).attr("rel"));
                }
            });

            $(thisObj).find(".pg-navigator .pg-next").click(function(){
                var next = $(thisObj).find(".pg-navigator .pg-current").next();
                if ($(next).hasClass("pg-normal")) {
                    methods.showPage.call(thisObj, $(next).attr("rel"));
                }
            });

            $(thisObj).find(".pg-navigator .pg-normal").click(function(){
                if (!$(this).hasClass("pg-current")) {
                    methods.showPage.call(thisObj, $(this).attr("rel"));
                }
            });
        },

        showPage: function(page) {
            var thisObj = $(this);

            //if page not exist, show page 1
            if ($(thisObj).find(".pg-navigator .pg-normal[rel="+page+"]").length === 0) {
                page = 1;
            }

            $(thisObj).find(".pg-navigator .pg-current").removeClass("pg-current");

            var table = $(thisObj).children("table");
            var options = $(table).data("pagingOptions");

            var start = options.size * (page - 1);
            var end = options.size * page;

            var candidateRows = $(table).find("tr.grid-row").not(".fg-hidden"); // hanya row yg tidak difilter
            candidateRows.each(function(i) {
                if (i >= start && i < end) {
                    $(this).addClass("pg-tr-show").removeClass("pg-tr-hide").show();
                } else {
                    $(this).removeClass("pg-tr-show").addClass("pg-tr-hide").hide();
                }
            });


            $(thisObj).find(".pg-navigator .pg-normal[rel="+page+"]").addClass("pg-current");
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
