<?php

namespace SimpleLocator\Services\LocationSearch;

use SimpleLocator\Repositories\SettingsRepository;
use SimpleLocator\Helpers;

/**
* Formats a result to match defined format
*/
class LocationResultPresenter
{

	/**
	* Result
	* @var object - WP SQL result
	*/
	private $result;

	/**
	* Count of this result
	* @var int
	*/
	private $count;

	/**
	* Results Fields from Settings
	* @var array
	*/
	private $results_fields;

	/**
	* Settings Repository
	*/
	private $settings_repo;

	/**
	* Formatted Output from Settings
	*/
	private $output;

	/**
	* Unit of Measurement
	*/
	private $distance_unit;


	public function __construct()
	{
		$this->settings_repo = new SettingsRepository;
		$this->output = $this->settings_repo->resultsFormatting();
		$this->results_fields = $this->settings_repo->getResultsFieldArray();
		$this->distance_unit = $this->settings_repo->measurementUnit();
	}

	/**
	* Primary Presenter Method
	* @return array
	*/
	public function present($result, $count)
	{
		$this->result = $result;
		$this->count = $count;
		return $this->setData();
	}

	/**
	* Set the primary result data
	* @return array
	*/
	private function setData()
	{
		$id = $this->result->ID;
		$location = array(
			'id' => $id,
			'title' => $this->result->post_title,
			'permalink' => get_permalink( $id ),
			'latitude' => $this->getLatLng( 'lat' ),
			'longitude' => $this->getLatLng( 'long' ),
			'output' => $this->formatOutput(),
			'infowindow' => $this->formatInfoWindow(),
			'marker'	=> $this->getMapMarker(),
			'terms' => $this->getTerms( $id )
		);
		return $location;
	}

	/**
	* Set the formatted output
	*/
	private function formatOutput()
	{
		$output = $this->output;
		$output = $this->replacePostFields($output);
		foreach($this->results_fields as $field){
			$found = $this->result->$field; // WP result object property
			$output = str_replace('[' . $field . ']', $found, $output);
		}

		$output = $this->removeEmptyTags($output);
		$output = Helpers::replaceURLs($output);
		$output = wpautop($output);

		$output = apply_filters('simple_locator_result', $output, $this->result, $this->count);

		return $output;
	}

	/**
	* Get the Lat Long
	*/
	private function getLatLng( $latlng = 'lat') {
		$meta_field = $this->settings_repo->getGeoField( $latlng );
		return get_post_meta( $this->result->ID, $meta_field );
	}

	/**
	* Render the info window output
	*/
	private function formatInfoWindow()
	{
		$infowindow = '<div data-result="' . $this->count . '"><h4>[post_title]</h4><p><a href="[post_permalink]" data-location-id="'.$this->result->id.'">'.__('View Location', 'wpsimplelocator').'</a></p></div>';
		$infowindow = $this->replacePostFields($infowindow);

		$infowindow = apply_filters('simple_locator_infowindow', $infowindow, $this->result, $this->count);

		return $infowindow;
	}

	/**
	* Render the marker
	*/
	private function getMapMarker()
	{
		$mapmarker = get_post_meta($this->result->ID, $this->settings_repo->getMapPinField(), true);
		//TODO Set as default pin from settings
		if (empty($mapmarker)) {
			$mapmarker = get_stylesheet_directory_uri() . '/dist/img/map-icons/farms.svg';
		}

		$mapmarker = apply_filters('simple_locator_mapmarker', $mapmarker, $this->result, $this->count);

		return $mapmarker;
	}

	/**
	* Replace post fields from settings
	*/
	private function replacePostFields($output)
	{
		if ( isset($this->result->geo_query_distance) ) $output = str_replace('[distance]', round($this->result->geo_query_distance, 2) . ' ' . $this->distance_unit, $output);
		$output = str_replace('[post_title]', $this->result->post_title, $output);

		if ( strpos($output, '[post_permalink]') !== false ){
			$output = str_replace('[post_permalink]', get_permalink($this->result->ID), $output);
		}
		if ( strpos($output, '[post_excerpt]') !== false ){
			$output = str_replace('[post_excerpt]', Helpers::excerptByID($this->result->ID), $output);
		}
		if ( strpos($output, '[post_thumbnail_') !== false ){
			$output = $this->addThumbnail($output);
		}

		// Show on Map Link
		$maplink = '<a href="#" class="infowindow-open map-link" onClick="event.preventDefault(); openInfoWindow(' . $this->count . ');">' . __('Show on Map', 'wpsimplelocator') . '</a>';
		$output = str_replace( '[show_on_map]', $maplink, $output );

		return $output;
	}

	private function getTerms( $id ) {
		$taxonomies = get_post_taxonomies( $id );
		$all_terms = array();
		foreach ( $taxonomies as $taxonomy ) {
			$terms = wp_get_post_terms( $id, $taxonomy );
			if ( is_wp_error( $terms ) ) {
				$terms = [];
			}
			$all_terms[ $taxonomy ] = $terms;
		}
		return $all_terms;
	}

	/**
	* Remove empty tags
	*/
	private function removeEmptyTags($output)
	{
		$output = preg_replace("/<p[^>]*><\\/p[^>]*>/", '', $output); // empty p tags
		$output = str_replace('<a href="http://">http://</a>', '', $output); // remove empty links
		$output = str_replace('<a href=""></a>', '', $output);
		$output = str_replace("\r\n\r\n", "\n", $output);
		return $output;
	}

	/**
	* Add the post thumbnail
	*/
	private function addThumbnail($output)
	{
		$sizes = get_intermediate_image_sizes();
		foreach ( $sizes as $size ){
			if ( strpos($output, '[post_thumbnail_' . $size) !== false ){
				$output = str_replace('[post_thumbnail_' . $size . ']', $this->getThumbnail($size), $output);
			}
		}
		return $output;
	}

	/**
	* Get thumbnail
	*/
	private function getThumbnail($size)
	{
		return ( has_post_thumbnail($this->result->id) )
			? get_the_post_thumbnail($this->result->id, $size)
			: ' ';
	}

}
