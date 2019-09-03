/**
 *
 * TODOS clean this up
 * - clarify functions, currently they are hard to follow
 * - Add callbacks that can actually be called from another page
 */

/**
 * Open a map info window, panto and zoom to bounds when a result is clicked
 */
function openInfoWindow(id) {
  google.maps.event.trigger(markers[id], "click");
  googlemap.panTo(markers[id].getPosition());
  googlemap.fitBounds(markers[id].getPosition());
  googlemap.setZoom(12);
  return false;
}
var markers = [];
var googlemap = "";
var markerCluster;
var mapHasClusters = false;

/**
 * Callback functions available to users
 * Place in Theme scripts to perform actions after map has rendered
 * Theme scripts should be enqueued with a script dependency for 'simple-locator'
 */

// Runs before form has been submitted/after click
function wpsl_before_submit(active_form, formelements) {}

// Runs after map & results render
function wpsl_after_render(active_form) {}

// Runs on click event on a map marker
function wpsl_click_marker(marker, i, active_form, post_id) {}

// Runs if no results were returned from the query
function wpsl_no_results(location, active_form) {}

// Runs on form error
function wpsl_error(message, active_form) {}

// Runs immediately on form success, pre-render of map/results
function wpsl_success(resultcount, results, active_form) {}

// Returns the Google Maps Response
function wpsl_googlemaps_response() {
  return googlemaps_response;
}

// Runs after locations map has rendered
function wpsl_all_locations_rendered(map) {}

// Runs after clicking on a marker in all locations map
function wpsl_all_locations_marker_clicked(marker, infoWindow) {}

var active_form = "";
var formatted_address = "";
var googlemaps_response = "";
var geolocation = false;

jQuery(function($) {
  $(document).ready(function() {
    enable_autocomplete();
    queue_default_map();
  });

  /**
   * Enable Places Autocomplete on the search form
   */
  function enable_autocomplete() {
    if (wpsl_locator.autocomplete !== "1") return;
    var inputs = $(".wpsl-location-search-field");
    $.each(inputs, function(i, v) {
      var autocomplete = new google.maps.places.Autocomplete(this);
      var submitBtn = $(this)
        .parents("form")
        .find(".wpslsubmit");
      google.maps.event.addListener(autocomplete, "place_changed", function() {
        geolocation = false;
        $(submitBtn).click();
      });
    });
  }

  /**
   * Queue the default map
   * @param boolean errors (geolocation errors) - if true, show default map (not user centered)
   */
  //TODO ADD SSL CHECK
  function queue_default_map(errors) {
    if (wpsl_locator.default_enabled) {
      if (
        wpsl_locator.default_user_center === "true" &&
        navigator.geolocation &&
        !errors
      ) {
        var forms = $(".simple-locator-form");
        $.each(forms, function(i, v) {
          var formelements = setFormElements($(this));
          $(formelements.results)
            .addClass("loading")
            .show();
          navigator.geolocation.getCurrentPosition(
            function(position) {
              process_geo_button(
                position,
                formelements,
                wpsl_locator.default_load_locations
              );
            },
            function(error) {
              //todo deal with errors
              queue_default_map(true);
              $(formelements.results)
                .removeClass("loading")
                .hide();
            }
          );
        });
      } else {
        loadDefault();
      }
    }
  }

  function default_load_results() {
    var forms = $(".simple-locator-form");
  }

  // Process the Search Form
  //This should be rewritten so that the submit function  can be called directly and has a callback
  $(".wpslsubmit").on("click", function(e) {
    e.preventDefault();
    var form = $(this).parents(".simple-locator-form");
    active_form = form;

    // Clear out lat/lng from any previous submissions
    $("input[name=latitude],input[name=longitude]").val("");

    var formelements = setFormElements(form);

    wpsl_before_submit(active_form, formelements);

    $(formelements.errordiv).hide();

    $(formelements.results)
      .addClass("loading")
      .show();

    generate_nonce(form, formelements, true);
  });

  /**
   * Generate and Inject the Nonce
   */
  function generate_nonce(form, formelements, processform) {
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
        if (processform) geocodeAddress(formelements);
      },
    });
  }
  /**
   * Set the address field with current location
   * @param string lat
   * @param string lng
   */
  function setAddress(lat, lng, addressfield) {
    console.log(setAddress, lat, lng, addressfield);
    var google_maps_position = new google.maps.LatLng(lat, lng);
    var google_maps_geocoder = new google.maps.Geocoder();
    google_maps_geocoder.geocode({ latLng: google_maps_position }, function(
      results,
      status
    ) {
      console.log(results);
      $(addressfield).val(results[0].formatted_address);
    });
  }

  /**
   * Load default map
   * @param {*} userlocation userlocation object or null
   */

  function loadDefault(userlocation) {
    var lat, lng;
    if (userlocation == null) {
      lat = wpsl_locator.default_latitude;
      lng = wpsl_locator.default_longitude;
    } else {
      lat = userlocation.coords.latitude;
      lng = userlocation.coords.longitude;
    }

    var forms = $(".simple-locator-form");
    $.each(forms, function(i, v) {
      formelements = setFormElements(this);
      formelements.map.show();
      var center = new google.maps.LatLng(lat, lng);
      var mapOptions = {
        center: center,
        zoom: parseInt(wpsl_locator.default_zoom),
        mapTypeControl: false,
        streetViewControl: false,
        styles: wpsl_locator.mapstyles,
      };
      // Override options if custom options are set
      if (wpsl_locator.custom_map_options === "1")
        mapOptions = wpsl_locator.map_options;
      mapOptions.center = center;

      var map = new google.maps.Map(formelements.map[0], mapOptions);
      formelements.results.removeClass("loading");
    });
  }

  /**
   * Set the form elements
   */
  function setFormElements(form) {
    var mapcont = ".wpsl-map";
    var resultscontainer = ".wpsl-results";
    var resultsheader = ".wpsl-resultsheader";

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

    formelements = {
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

  /**
   * Geocode the address prior to submitting the search form
   */
  function geocodeAddress(formelements) {
    var address = $(formelements.address).val();

    if ($(formelements.form).hasClass("allow-empty") && address === "") {
      return sendFormData(formelements);
    }

    if (
      $(formelements.form).hasClass("allow-empty") &&
      typeof address == "undefined"
    ) {
      return sendFormData(formelements);
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
            return sendFormData(formelements);
          }
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

  /**
   * Append fields to non-ajax forms
   */
  function appendNonAjaxFields(formelements) {
    $(formelements.form).append(
      '<input type="hidden" name="formatted_address" value="' +
        formatted_address +
        '">'
    );
    $(formelements.form).append(
      '<input type="hidden" name="geolocation" value="' + geolocation + '">'
    );
    $(formelements.form).submit();
  }

  /**
   * Send the form data to the form handler
   */
  function sendFormData(formelements) {
    var taxonomies = $(formelements.taxonomy).serializeArray(); // checkboxes
    console.log("sendForm Taxonomies");
    console.log(taxonomies);
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
      geolocation: geolocation,
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
    console.log("sending");
    console.log(formdata);

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
          wpsl_error(data.message, active_form);
          $(formelements.errordiv)
            .text(data.message)
            .show();
        } else {
          wpsl_success(data.result_count, data.results, active_form);
          loadLocationResults(data, formelements);
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

  /**
   * Load the results into the view
   */
  function loadLocationResults(data, formelements) {
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
    if (data.result_count > 0) {
      var output = "";

      if (wpsl_locator_options.resultswrapper !== "")
        output += "<" + wpsl_locator_options.resultswrapper + ">";

      for (i = 0; i < data.results.length; i++) {
        output = output + data.results[i].output;
      }

      if (wpsl_locator_options.resultswrapper !== "")
        output += "</" + wpsl_locator_options.resultswrapper + ">";

      $(formelements.list).html(output);

      //TODO not sure why do we need this
      $(formelements.zip)
        .val("")
        .blur();

      showLocationMap(data, formelements);
    } else {
      // Clear markers and reset array
      if (mapHasClusters) {
        markerCluster.clearMarkers();
      } else {
        for (var i = 0; i < markers.length; i++) {
          markers[i].setMap(null);
        }
      }
      markers = [];
    }

    $(formelements.results).removeClass("loading");

    // Simple Locator Callback function after results have rendered
    wpsl_after_render(active_form);
  }

  /**
   * Load the Google map and show locations found
   */
  function showLocationMap(data, formelements) {
    // Reset the global markers array
    markers = [];

    // Set the optional user parameters
    var mapcont = $(formelements.map)[0];

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

    var bounds = new google.maps.LatLngBounds();
    var mapOptions = {
      mapTypeId: "roadmap",
      mapTypeControl: false,
      zoom: 8,
      styles: wpsl_locator.mapstyles,
      panControl: false,
      disableDefaultUI: disablecontrols,
      zoomControlOptions: {
        style: google.maps.ZoomControlStyle.SMALL,
        position: controlposition,
      },
    };
    var clustersPath = wpsl_locator_options.clusters;
    // Override options if custom options are set
    if (wpsl_locator.custom_map_options === "1")
      mapOptions = wpsl_locator.map_options;
    var locations = [];
    var infoWindow = new google.maps.InfoWindow(),
      marker,
      i;

    map = new google.maps.Map(mapcont, mapOptions);

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
          anchor: new google.maps.Point(0, 0),
        },
      };
      locations.push(location);
    }

    // Loop through array of markers & place each one on the map
    for (i = 0; i < locations.length; i++) {
      var position = new google.maps.LatLng(locations[i].lat, locations[i].lng);
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

            // Simple Locator Callback function for click event
            wpsl_click_marker(marker, i, active_form, locations[i].id);
          };
        })(marker, i)
      );

      // Push the marker to the global 'markers' array
      markers.push(marker);

      // Center the Map
      map.fitBounds(bounds);
      var listener = google.maps.event.addListener(map, "idle", function() {
        if (data.results.length < 2) {
          map.setZoom(13);
        }
        google.maps.event.removeListener(listener);
      });
    }

    // Add Marker Clustering
    if (clustersPath !== "false") {
      mapHasClusters = true;
      markerCluster = new MarkerClusterer(map, markers, {
        imagePath: clustersPath,
      });
    }

    // Fit the map bounds to all the pins
    var boundsListener = google.maps.event.addListener(
      map,
      "bounds_changed",
      function(event) {
        google.maps.event.removeListener(boundsListener);
      }
    );

    // Set the global map var
    googlemap = map;
  }

  /**
   * ======================================================
   * Geolocation button
   * ======================================================
   */
  function append_geo_button() {
    if (wpsl_locator.showgeobutton !== "true") return false;
    if (navigator.geolocation) {
      var html =
        '<button class="wpsl-geo-button" title="Use my current location">' +
        wpsl_locator.geobuttontext +
        "</button>";
      $(".geo_button_cont").html(html);
    }
  }

  function process_geo_button(position, formelements, loadResults) {
    var longitude = position.coords.longitude;
    var latitude = position.coords.latitude;

    $(formelements.latitude).val(latitude);
    $(formelements.longitude).val(longitude);

    geolocation = true;
    setAddress(latitude, longitude, formelements.address);
    if (loadResults == true) {
      sendFormData(formelements);
    } else {
      loadDefault(position);
    }
  }

  $(document).ready(function() {
    append_geo_button();
    $(".simple-locator-form").each(function() {
      generate_nonce($(this));
    });
  });

  $(document).on("click", ".wpsl-geo-button", function(e) {
    e.preventDefault();
    console.log("geo button");
    var form = $(this).parents(".simple-locator-form");
    active_form = form;
    var formelements = setFormElements(form);

    $(formelements.errordiv).hide();

    $(formelements.results).addClass("loading");

    navigator.geolocation.getCurrentPosition(function(position) {
      process_geo_button(position, formelements, true);
    });
  });
}); // jQuery
