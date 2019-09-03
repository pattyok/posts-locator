/**
 *
 * TODOS clean this up
 * - clarify functions, currently they are hard to follow
 * - Add callbacks that can actually be called from another page
 */

jQuery(function($) {
  /**
   * Generate a unique guid of any length
   * @param {} length
   */
  function generateGuid(length) {
    let radom13chars = function() {
      return Math.random()
        .toString(16)
        .substring(2, 15);
    };
    let loops = Math.ceil(length / 13);
    return new Array(loops)
      .fill(radom13chars)
      .reduce((string, func) => {
        return string + func();
      }, "")
      .substring(0, length);
  }

  /**
   * Enable autocomplete on search fields
   */

  function enableAutocomplete() {
    if (wpsl_locator.autocomplete !== "1") return;
    var inputs = $(".wpsl-location-search-field");
    $.each(inputs, function(i, v) {
      var autocomplete = new google.maps.places.Autocomplete(this);
      var submitBtn = $(this)
        .parents("form")
        .find(".wpslsubmit");
      google.maps.event.addListener(autocomplete, "place_changed", function() {
        m.geolocation = false;
        $(submitBtn).click();
      });
    });
  }

  function queueDefaultMap(errors) {
    if (wpsl_locator.default_enabled) {
      if (
        wpsl_locator.default_user_center === "true" &&
        navigator.geolocation &&
        location.protocol === "https:" &&
        !errors
      ) {
        $.each(m.forms, function(i, form) {
          var formelements = getFormElements(form);
          $(formelements.results)
            .addClass("loading")
            .show();
          navigator.geolocation.getCurrentPosition(
            function(position) {
              processGeoButton(
                position,
                form,
                wpsl_locator.default_load_locations
              );
            },
            function(error) {
              //todo deal with errors
              queueDefaultMap(true);
              $(formelements.results)
                .removeClass("loading")
                .hide();
            }
          );
        });
      } else {
        loadDefaultMap();
      }
    }
  }

  function appendGeoButton() {
    if (wpsl_locator.showgeobutton !== "true" || location.protocol !== "https:")
      return false;
    if (navigator.geolocation) {
      var html =
        '<button class="wpsl-geo-button" title="Use my current location">' +
        wpsl_locator.geobuttontext +
        "</button>";
      $(".geo_button_cont").html(html);
    }
  }

  function setFormElements(form) {
    var mapcont = ".wpsl-map";
    var resultscontainer = ".wpsl-results";
    var resultsheader = ".wpsl-resultsheader";
    var active_form = m.activeForm;
    //TODO old function dealt with multiple forms one page, not sure we need to do that.
    // Get the DOM elements for results. Either a class within the form or a unique ID
    if ($(active_form).siblings("#widget").length < 1) {
      // Not the Widget
      if (wpsl_locator_options.mapcont.charAt(0) === ".") {
        var mapcont = $(form).find(wpsl_locator_options.mapcont);
      } else {
        var mapcont = $(wpsl_locator_options.mapcont);
      }
      if (wpsl_locator_options.resultscontainer.charAt(0) === ".") {
        var resultscontainer = $(form).find(
          wpsl_locator_options.resultscontainer
        );
      } else {
        var resultscontainer = $(wpsl_locator_options.resultscontainer);
      }
      if (wpsl_locator_options.resultsheader.charAt(0) === ".") {
        var resultsheader = $(form).find(wpsl_locator_options.resultsheader);
      } else {
        var resultsheader = $(wpsl_locator_options.resultsheader);
      }
      if (wpsl_locator_options.resultswrapper.charAt(0) === ".") {
        var resultswrapper = $(form).find(wpsl_locator_options.resultswrapper);
      } else {
        var resultswrapper = $(wpsl_locator_options.resultswrapper);
      }
    } else {
      // Its the widget
      var mapcont = $(active_form).find(mapcont);
      var resultscontainer = $(active_form).find(resultscontainer); //this wraps the list view prolly should be renamed?
      var resultsheader = $(active_form).find(resultsheader);
      var resultswrapper = $(active_form).find(resultswrapper);
    }
    var formelements = {
      parentdiv: $(form),
      errordiv: $(form).find(".wpsl-error"),
      map: mapcont,
      list: resultscontainer,
      results: resultswrapper,
      resultsheader: resultsheader,
      distance: $(form).find(".distanceselect"),
      address: $(form).find(".address"),
      latitude: $(form).find(".latitude"),
      longitude: $(form).find(".longitude"),
      limit: $(form).find(".limit"),
      unit: $(form).find(".unit"),
      taxonomy: $(form).find('input[name^="taxonomy"]:checked'),
      taxonomy_select: $(form).find('select[name^="taxonomy"]'),
      form: $(form).find("form"),
      textsearch: $(form).find(".text-search"),
    };
    return formelements;
  }

  function getFormElements(form) {
    var guid = $(form).data("guid");
    return m.formelements[guid];
  }

  function processGeoButton(position, form, loadResults) {
    var longitude = position.coords.longitude;
    var latitude = position.coords.latitude;
    var formelements = getFormElements(form);

    $(formelements.latitude).val(latitude);
    $(formelements.longitude).val(longitude);

    m.geolocation = true;
    setAddress(latitude, longitude, formelements.address);
    if (loadResults == true) {
      sendFormData(form);
    } else {
      loadDefaultMap(position);
    }
  }

  function setAddress(lat, lng, addressfield) {
    var google_maps_position = new google.maps.LatLng(lat, lng);
    var google_maps_geocoder = new google.maps.Geocoder();
    google_maps_geocoder.geocode({ latLng: google_maps_position }, function(
      results,
      status
    ) {
      $(addressfield).val(results[0].formatted_address);
    });
  }

  /**
   * you can pass callbacks to this function in order to override the default actions
   * @param {string} form
   * @param {function} success
   * @param {function} error
   */
  function submitForm(form, filters, submit_success, submit_error) {
    var formelements = getFormElements(form);
    $(formelements.errordiv).hide();

    $(formelements.results).addClass("loading");

    if (submit_error == null) {
      error = function(message, formelements) {
        submit_error = $(formelements.errordiv)
          .text(message)
          .show();
      };
    }

    if (submit_success == null) {
      submit_success = function(data, form) {
        loadLocationResults(data, form, function(form) {
          if (typeof filters !== "undefined") {
            filterResults(filters, form);
          }
        });
        $(formelements.results).removeClass("loading");
      };
    }

    geocodeAddress(formelements, function() {
      sendFormData(form, submit_success, submit_error);
    });
  }

  /**
   * Geocode the address prior to submitting the search form
   */
  function geocodeAddress(formelements, callback) {
    var address = $(formelements.address).val();

    if ($(formelements.form).hasClass("allow-empty") && address === "") {
      if (callback) {
        return callback(formelements);
      }
    }

    if (
      $(formelements.form).hasClass("allow-empty") &&
      typeof address == "undefined"
    ) {
      if (callback) {
        return callback(formelements);
      }
    }

    geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      {
        address: address,
      },
      function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          googlemaps_response = results;
          var latitude = results[0].geometry.location.lat();
          var longitude = results[0].geometry.location.lng();
          formatted_address = results[0].formatted_address;

          if (wpsl_locator.jsdebug === "1") {
            console.log("Google Geocode Response");
            console.log(results);
          }

          $(formelements.latitude).val(latitude);
          $(formelements.longitude).val(longitude);

          if ($(formelements.form).find("#wpsl_action").length === 0) {
            if (callback) {
              return callback(formelements);
            }
          }
          //TODO Deal with Non Ajax Form
          return appendNonAjaxFields(formelements);
        } else {
          wpsl_error(wpsl_locator.notfounderror, active_form);
          $(formelements.errordiv)
            .text(wpsl_locator.notfounderror)
            .show();
        }
      }
    );
  }

  function sendFormData(form, wpsl_success, wpsl_error) {
    var formelements = getFormElements(form);
    var taxonomies = $(formelements.taxonomy).serializeArray(); // checkboxes

    // Select Menus
    if (formelements.taxonomy.length == 0) {
      var inputs = $(formelements.taxonomy_select);
      $.each(inputs, function(i, v) {
        if ($(this).val() === "") return;
        var selected = {};
        selected.name = $(this).attr("name");
        selected.value = $(this).val();
        taxonomies.push(selected);
      });
    }

    // Create an array from the selected taxonomies
    var taxonomy_array = {};
    $.each(taxonomies, function(i, v) {
      var tax_name = this.name.replace(/(^.*\[|\].*$)/g, "");
      if (
        typeof taxonomy_array[tax_name] == undefined ||
        !(taxonomy_array[tax_name] instanceof Array)
      )
        taxonomy_array[tax_name] = [];
      if (tax_name) {
        if (this.value == "any") {
          taxonomy_array[tax_name] = "any";
        }
        if (taxonomy_array[tax_name] !== "any") {
          taxonomy_array[tax_name].push(this.value);
        }
      }
    });

    var allow_empty_address = $(formelements.form).hasClass("allow-empty")
      ? true
      : false;
    var address =
      typeof $(formelements.address).val() == "undefined"
        ? false
        : $(formelements.address).val();
    var distance =
      typeof $(formelements.distance).val() == "undefined"
        ? false
        : $(formelements.distance).val();

    formdata = {
      action: "locate",
      address: address,
      formatted_address: formatted_address,
      locatorNonce: $(".locator-nonce").val(),
      distance: distance,
      latitude: $(formelements.latitude).val(),
      longitude: $(formelements.longitude).val(),
      limit: $(formelements.limit).val(),
      unit: $(formelements.unit).val(),
      geolocation: m.geolocation,
      taxonomies: taxonomy_array,
      allow_empty_address: allow_empty_address,
      textsearch: $(formelements.textsearch).val(),
    };

    // Custom Input Data (for SQL filter availability)
    if (wpsl_locator.postfields.length > 0) {
      for (var i = 0; i < wpsl_locator.postfields.length; i++) {
        var field = wpsl_locator.postfields[i];
        formdata[field] = $("input[name=" + field + "]").val();
      }
    }

    $.ajax({
      url: wpsl_locator.ajaxurl,
      type: "post",
      datatype: "json",
      data: formdata,
      success: function(data) {
        if (wpsl_locator.jsdebug === "1") {
          console.log("Form Response");
          console.log(data);
        }
        if (data.status === "error") {
          //callback allows error function to be overridden
          if (wpsl_error) {
            wpsl_error(data.message, form);
          }
        } else {
          if (wpsl_success) {
            wpsl_success(data, form);
          }
        }
      },
      error: function(data) {
        if (wpsl_locator.jsdebug === "1") {
          console.log("Form Response Error");
          console.log(data.responseText);
        }
      },
    });
  }
  function clearFilters(form) {
    var formid = $(form).data("guid");
    var data = m.results[formid].full;
    updateLocationResults(data, form);
  }
  function filterResults(filters, form, after_filter_results) {
    var formid = $(form).data("guid");
    var results = m.results[formid];
    var postsById = results.postsById;
    var filtered = [];
    var ids;
    var updated = {};
    updated.results = [];
    if (results == null) {
      return;
    }
    //push each group into an array;
    $.each(filters, function(tax, slugs) {
      $.each(slugs, function(x, slug) {
        if (results.termsList.hasOwnProperty(tax)) {
          filtered.push(results.termsList[tax][slug]);
        }
      });
    });
    ids = _.intersection.apply(null, filtered);
    $.each(ids, function(n, id) {
      var post;
      if (results.full.results[postsById[id]]) {
        post = results.full.results[postsById[id]];
      }
      updated.results.push(post);
    });
    if (after_filter_results) {
      after_filter_results(updated, form);
    } else {
      updateLocationResults(updated, form);
    }
  }
  /**
   * Put results into arrays by taxonomy and by id
   * @param {array} results
   */
  function prepTaxonomies(results, form) {
    var formid = $(form).data("guid");
    var termsList = {};
    var postsById = {};
    $.each(results, function(i, result) {
      var post_id = result.id;
      postsById[post_id] = i;
      $.each(result.terms, function(tax_slug, tax_items) {
        if (tax_items.length > 0) {
          $.each(tax_items, function(n, term) {
            term_slug = term.slug;
            if (termsList[tax_slug]) {
              termsList[tax_slug]["any"].push(post_id);
              if (termsList[tax_slug][term_slug]) {
                termsList[tax_slug][term_slug].push(post_id);
              } else {
                termsList[tax_slug][term_slug] = [post_id];
              }
            } else {
              termsList[tax_slug] = {};
              termsList[tax_slug][term_slug] = [post_id];
              termsList[tax_slug].any = [post_id];
            }
          });
        }
      });
    });
    m.results[formid].termsList = termsList;
    m.results[formid].postsById = postsById;
  }

  function updateLocationResults(data, form, wpsl_after_update) {
    var formid = $(form).data("guid");
    var formelements = getFormElements(form);
    if (data.results == null) {
      data.result_count = 0;
    } else {
      data.result_count = data.results.length;
    }
    var location =
      data.result_count === 1 ? wpsl_locator.location : wpsl_locator.locations;
    var count = data.result_count + " " + location;
    $(".wpsl-results-header .count").html(count);

    loadLocationList(data, formelements);
    loadLocationsOnMap(data, formid);

    // Simple Locator Callback function after results have rendered
    if (wpsl_after_update) {
      wpsl_after_update(m.active_form);
    }
  }

  function loadLocationResults(data, form, wpsl_after_render) {
    var formid = $(form).data("guid");
    var formelements = getFormElements(form);
    var map = m.maps[formid];

    if (m.results.formid) {
      m.results[formid].full = data;
    } else {
      m.results[formid] = {};
      m.results[formid].full = data;
    }
    prepTaxonomies(data.results, form);

    if (data.results == null) {
      data.result_count = 0;
    } else {
      data.result_count = data.results.length;
    }

    var location =
      data.result_count === 1 ? wpsl_locator.location : wpsl_locator.locations;
    var address = data.formatted_address.replace(", USA", "");
    var header =
      '<div class="wpsl-results-header"><span class="count">' +
      data.result_count +
      " " +
      location +
      "</span>";
    if (data.latitude !== "")
      header +=
        ' <span class="distance">' +
        wpsl_locator.found_within +
        " " +
        data.distance +
        " " +
        data.unit +
        '</span> <span class="location">' +
        wpsl_locator.of +
        " ";
    header +=
      data.using_geolocation === "true" ? wpsl_locator.yourlocation : address;
    header += "</span></div>";

    formelements.resultsheader.html(header);
    loadLocationList(data, formelements);

    loadLocationsOnMap(data, formid);

    // Simple Locator Callback function after results have rendered
    if (wpsl_after_render) {
      wpsl_after_render(form);
    }
  }

  function loadLocationList(data, formelements) {
    var output = "";

    if (data.result_count > 0) {
      for (i = 0; i < data.results.length; i++) {
        output = output + data.results[i].output;
      }
    } else {
      output += wpsl_locator_options.noresultstext;
    }

    $(formelements.list).html(output);
  }

  /**
   * Load the Google map and show locations found
   */
  function loadLocationsOnMap(data, formid) {
    var locations = [];
    var bounds = new google.maps.LatLngBounds();
    var clustersPath = wpsl_locator_options.clusters;
    var infoWindow = new google.maps.InfoWindow(),
      marker,
      i;
    var map = m.maps[formid].map;
    var markers = m.maps[formid].markers;
    //clear any existing markers
    if (markers && markers.length > 0) {
      if (m.maps[formid].mapHasClusters == true) {
        m.maps[formid].markerCluster.clearMarkers();
      } else {
        for (var i = 0; i < markers.length; i++) {
          markers[i].setMap(null);
        }
      }
    }

    //reset global markers
    markers = [];

    if (data.result_count === 0) {
      return;
    }

    // Array of locations
    for (var i = 0, length = data.results.length; i < length; i++) {
      var location = {
        title: data.results[i].title,
        lat: data.results[i].latitude,
        lng: data.results[i].longitude,
        id: data.results[i].id,
        infowindow: data.results[i].infowindow,
        marker: {
          url: data.results[i].marker,
          scaledSize: new google.maps.Size(38, 50),
          origin: new google.maps.Point(0, 0),
          anchor: new google.maps.Point(19, 50),
        },
      };
      locations.push(location);
    }

    var oms = new OverlappingMarkerSpiderfier(map, {
      markersWontMove: true,
      markersWontHide: true,
      basicFormatEvents: true,
      nearbyDistance: 20,
      keepSpiderfied: true,
    });

    // Loop through array of markers & place each one on the map
    for (i = 0; i < locations.length; i++) {
      (function() {
        var position = new google.maps.LatLng(
          locations[i].lat,
          locations[i].lng
        );
        bounds.extend(position);

        marker = new google.maps.Marker({
          position: position,
          map: map,
          title: locations[i].title,
          icon: locations[i].marker,
        });

        // Info window for each marker
        google.maps.event.addListener(
          marker,
          "click",
          (function(marker, i) {
            return function() {
              infoWindow.setContent(locations[i].infowindow);
              infoWindow.open(map, marker);
            };
          })(marker, i)
        );
        // Push the marker to the global 'markers' array
        oms.addMarker(marker);
        markers.push(marker);
      })();
    }

    // Add Marker Clustering
    if (clustersPath !== "false") {
      m.maps[formid].mapHasClusters = true;
      m.maps[formid].markerCluster = new MarkerClusterer(map, markers, {
        imagePath: clustersPath,
        maxZoom: 15,
        minimumClusterSize: 5,
      });
    }

    map.fitBounds(bounds);

    //update global object
    m.maps[formid].markers = markers;

    var listener = google.maps.event.addListener(map, "idle", function() {
      if (data.results.length < 2) {
        map.setZoom(13);
      }
      m.maps[formid].markerCluster.resetViewport();
      m.maps[formid].markerCluster.redraw();
      google.maps.event.removeListener(listener);
    });

    // Fit the map bounds to all the pins
    var boundsListener = google.maps.event.addListener(
      map,
      "bounds_changed",
      function(event) {
        console.log(map.zoom);
        google.maps.event.removeListener(boundsListener);
      }
    );
  }

  function generateNonce(form, formelements) {
    $.ajax({
      url: wpsl_locator.ajaxurl,
      type: "post",
      datatype: "json",
      data: {
        action: "locatornonce",
      },
      success: function(data) {
        if (wpsl_locator.jsdebug === "1") {
          console.log("Nonce Generation Response");
          console.log(data);
        }
        $(".locator-nonce").remove();
        $(form)
          .find("form")
          .append(
            '<input type="hidden" class="locator-nonce" name="nonce" value="' +
              data.nonce +
              '" />'
          );
      },
    });
  }

  function loadDefaultMap(userlocation) {
    var lat, lng;
    if (typeof wpsl_locator_options != "undefined") {
      var disablecontrols =
        wpsl_locator_options.mapcontrols === "show" ? false : true;
    } else {
      var disablecontrols = false;
    }

    // Control Position
    if (typeof wpsl_locator_options != "undefined") {
      var controlposition =
        google.maps.ControlPosition[wpsl_locator_options.mapcontrolsposition];
    } else {
      var controlposition = "TOP_LEFT";
    }

    if (userlocation == null) {
      lat = wpsl_locator.default_latitude;
      lng = wpsl_locator.default_longitude;
    } else {
      lat = userlocation.coords.latitude;
      lng = userlocation.coords.longitude;
    }
    $.each(m.formelements, function(i, formelements) {
      formelements.map.show();
      var center = new google.maps.LatLng(lat, lng);
      var mapOptions = {
        mapTypeId: "roadmap",
        center: center,
        zoom: parseInt(wpsl_locator.default_zoom),
        mapTypeControl: false,
        streetViewControl: false,
        panControl: false,
        fullscreenControl: false,
        styles: wpsl_locator.mapstyles,
        disableDefaultUI: disablecontrols,
        zoomControlOptions: {
          style: google.maps.ZoomControlStyle.SMALL,
          position: controlposition,
        },
      };
      // Override options if custom options are set
      if (wpsl_locator.custom_map_options === "1")
        mapOptions = wpsl_locator.map_options;
      mapOptions.center = center;
      var map = new google.maps.Map(formelements.map[0], mapOptions);
      m.maps[i] = {
        map: map,
      };
      formelements.results.removeClass("loading");
    });
  }

  //Load functions into object that can be accessed via other files
  var m = {
    formelements: {},
    active_form: "",
    forms: $(".simple-locator-form"),
    geolocation: false,
    maps: {},
    results: {},
    filterResults: filterResults,
    clearFilters: clearFilters,
    submitForm: submitForm,
    initForm: function(callback) {
      appendGeoButton();
      $.each(this.forms, function(i, v) {
        var formelements = setFormElements($(this));
        var guid = generateGuid(15);
        $(this).attr("data-guid", guid);
        m.formelements[guid] = formelements;
        generateNonce(this);
      });
      enableAutocomplete();
      if (callback) {
        callback();
      } else {
        queueDefaultMap();
      }
      wpsl_locator.m = m;
    },
  };

  $(document).ready(function() {
    m.initForm();

    // Process the Search Form
    $(".wpslsubmit").on("click", function(e) {
      e.preventDefault();
      var form = $(this).parents(".simple-locator-form");
      m.active_form = form;
      submitForm(m.active_form);
    });
  });
}); // jQuery
