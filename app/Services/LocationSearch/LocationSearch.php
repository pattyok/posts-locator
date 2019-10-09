<?php

namespace SimpleLocator\Services\LocationSearch;

use SimpleLocator\Repositories\SettingsRepository;
use SimpleLocator\Services\LocationSearch\LocationResultPresenter;
use SimpleLocator\Helpers;

/**
* Search Locations
*/
class LocationSearch
{

	/**
	* Form Data
	* @var array
	*/
	private $data;

	/**
	* Settings Repository
	* @var SimpleLocator\Repositories\SettingsRepository
	*/
	private $settings_repo;

	/**
	* Result Presenter
	* @var SimpleLocator\Services\LocationSearch\LocationResultPresenter
	*/
	private $result_presenter;

	/**
	* Results Fields from Settings
	* @var array
	*/
	private $results_fields;

	/**
	* Query Data
	* @var array
	*/
	private $query_data;

	/**
	* Query - the SQL
	*/
	private $sql;

	/**
	* Query Results
	* @var array
	*/
	private $results;

	/**
	* Total Results (with limit)
	* @var int
	*/
	private $result_count;

	/**
	* Total Results (without limit)
	* @var int
	*/
	private $total_results;

	/**
	* Address Provided
	* @var boolean
	*/
	private $address;

	public function __construct()
	{
		$this->settings_repo = new SettingsRepository;
		$this->result_presenter = new LocationResultPresenter;
	}

	/**
	* Perform the Search
	*/
	public function search()
	{
		$this->setResultsFields();
		$this->setAddress();
		$this->setTextSearch();
		$this->setData();
		$this->setQuery();
		$this->runQuery();
	}

	/**
	* Set the results fields
	*/
	private function setResultsFields()
	{
		$this->results_fields = $this->settings_repo->getResultsFieldArray();
	}

	/**
	* Was an address provided
	*/
	private function setAddress()
	{
		$this->address = ( $_POST['latitude'] != "") ? true : false;
	}

	/**
	* Was a text search provided
	*/
	private function setTextSearch()
	{
		$this->textsearch = ( $_POST['textsearch'] != "") ? true : false;
	}

	/**
	* Sanitize the user-submitted data and set vars used in search
	*/
	private function setData()
	{
		$this->data = array(
			'distance' => sanitize_text_field($_POST['distance']),
			'userlat' => sanitize_text_field($_POST['latitude']),
			'userlong' => sanitize_text_field($_POST['longitude']),
			'textsearch' => sanitize_text_field($_POST['textsearch']),
			'unit' => sanitize_text_field($_POST['unit']),
			'offset' => ( isset($_POST['page']) ) ? sanitize_text_field(intval($_POST['page'])) : null,
			'limit' => ( isset($_POST['limit']) ) ? sanitize_text_field(intval($_POST['limit'])) : -1,
			'post_type' => get_option('wpsl_post_type'),
			'lat_field' => get_option('wpsl_lat_field'),
			'lng_field' => get_option('wpsl_lng_field'),
		);

		if ( isset($_POST['taxonomies']) ) {
			$this->setTaxonomies();
		}
	}

	/**
	* Set Taxonomy Filters
	*/
	private function setTaxonomies()
	{
		$this->taxonomy = true;
		$terms = $_POST['taxonomies'];
		$this->data['taxonomies'] = $terms;
	}


	/**
	* Add Taxonomy Joins to limit by taxonomy if available
	*/
	private function taxonomyQuery()
	{
		if ( !isset($this->data['taxonomies']) ) return;
		$tax_args = array();
		foreach ( $this->data['taxonomies'] as $taxonomy_name => $ids ){
			if ( is_array($ids) ){
				$tax = array(
					'taxonomy' => $taxonomy_name,
					'field'		=> 'term_id',
					'terms' => $ids,
				);
			} else {
				$tax = array(
					'taxonomy' => $taxonomy_name,
					'operator' => 'EXISTS',
				);
			}
			$tax_args[] = $tax;
			if ( count($tax_args) > 1) {
				$tax_args['relatiion'] = 'AND';
			}
		}
		return apply_filters('simple_locator_tax_query', $tax_args);
	}

	/**
	* SQL Where Constraints
	*/
	private function geoQuery()
	{
		$geo = array(
			'lat_field' => $this->data['lat_field'],
			'lng_field' => $this->data['lng_field'],
			'latitude'  => $this->data['userlat'],
			'longitude' => $this->data['userlong'],
			'distance'  => $this->data['distance'],
			'units'     => $this->data['distance_unit'],// this supports options: miles, mi, kilometers, km
		);
		return apply_filters('simple_locator_geo_query', $geo);
	}


	/**
	* Set the Query
	*/
	private function setQuery()
	{
		$args = array(
			'post_type' => $this->data['post_type'],
			'post_status' => 'publish',
			'order'     => 'ASC',
			'posts_per_page' => $this->data['limit'],
		);
		if ( $this->textsearch ) {
			$args['s'] = $this->data['textsearch'];
			$args['orderby']   = 'title';
		}
		if ( $this->address ) {
			$args['geo_query'] = $this->geoQuery();
			$args['orderby']   = 'distance';
		};
		if ( $this->taxonomy ) {
			$args['tax_query'] = $this->taxonomyQuery();
		}
		error_log(print_r($args, true));
		$this->args = $args;
	}

	/**
	* Lookup location data
	*/
	private function runQuery()
	{
		$query_args = apply_filters('simple_locator_full_query', $this->args);
		error_log(print_r($query_args, true));
		// Run the Query
		$query = new \WP_Query($query_args);

		$results = $query->posts;
		$this->result_count = count($results);
		$this->setResults($results);
		// if ( $this->data['limit'] ) $this->setTotalResults();
	}

	/**
	* Prepare Results
	*/
	private function setResults($results)
	{
		foreach ( $results as $key => $result ) {
			$location = $this->result_presenter->present($result, $key);
			$this->results[] = $location;
		}
	}

	/**
	* Get Total Number of results without pagination
	*/
	private function setTotalResults()
	{
		global $wpdb;
		$sql = "
			SELECT DISTINCT p.ID";
			$this->distanceVars();
			$sql .= "\nFROM " . $this->query_data['post_table'] . " AS p";
			$sql .= $this->sqlWhere();
			if ( $this->address ) {
				$sql .= "\nHAVING distance < @distance\n";
			}

		// Set the SQL Vars
		if ( $this->address ){
			$wpdb->query("SET SQL_BIG_SELECTS=1");
			$wpdb->query("SET @origlat = " . $this->query_data['userlat'] . ";");
			$wpdb->query("SET @origlng = " . $this->query_data['userlong'] . ";");
			$wpdb->query("SET @distance = " . $this->query_data['distance'] . ";");
			$wpdb->query("SET @dist_unit = " . $this->query_data['distance_unit'] . ";");
		}

		$results = $wpdb->get_results($sql);
		$this->total_results = count($results);
	}

	/**
	* Get Result Count (limit)
	*/
	public function getResultCount()
	{
		return $this->result_count;
	}

	/**
	* Get Result Count (limit)
	*/
	public function getTotalResultCount()
	{
		return $this->total_results;
	}

	/**
	* Get Results
	*/
	public function getResults()
	{
		return $this->results;
	}
}
