<?php
$output = "";

// Is this a widget form or a shortcode form
if ( isset($widget_instance) ) {
	$output .= '<div class="simple-locator-widget">';
	$mapheight = ( isset($instance['map_height']) ) ? $instance['map_height'] : 200;
	$this->options['addresslabel'] = __('Zip/Postal Code', 'wpsimplelocator');
	$this->options['mapcontainer'] = '.wpsl-map';
	$this->options['placeholder'] = ( isset($instance['placeholder']) ) ? $instance['placeholder'] : '';
	$output .= '<span id="widget"></span>';
} else {
	$mapheight = $this->options['mapheight'];
}

$output .= '
<div class="simple-locator-form">
<form';
if ( isset($this->options['allowemptyaddress']) && $this->options['allowemptyaddress'] == 'true' ) $output .= ' class="allow-empty"';
$output .= '>
	<div class="wpsl-error alert alert-error" style="display:none;"></div>
	<div class="text-input form-field">
		<input type="search" name="text-search" class="text-search wpsl-text-search-field" placeholder="' . $this->options['textplaceholder'] . '" />
	</div>
	<div class="address-input form-field">
		<label for="zip">' . $this->options['addresslabel'] . '</label>
		<input type="search" name="address" class="address wpsl-location-search-field" placeholder="' . $this->options['placeholder'] . '" />
	</div>
	<div class="distance form-field">
		<label for="distance">' . __('Distance', 'wpsimplelocator'). '</label>
		<select name="distance" class="distanceselect">' .
			$this->distanceOptions() .
		'</select>
	</div>';
	if ( isset($this->taxonomies) ) :
		if ( $this->taxonomiesstyle == "select") :
			foreach ( $this->taxonomies as $tax_name => $taxonomy ) :
				$output .= '<div class="wpsl-taxonomy-filter select-list">
				<label class="taxonomy-label">' . $taxonomy['label'] . '</label>
				<select name="taxonomy[' . $tax_name . ']">
					<option value="">--</option>';
					foreach ( $taxonomy['terms'] as $term ){
						$output .= '<option value="' . $term->term_id . '" />' . $term->name . '</option>';
					}
				$output .= '</select>
				</div><!-- .taxonomy -->';
			endforeach;
		else :
			foreach ( $this->taxonomies as $tax_name => $taxonomy ) :
				$output .= '<div class="wpsl-taxonomy-filter checkboxes wpsl-taxonomy-filter-' . $tax_name . '">
					<label class="taxonomy-label  taxonomy-label-' . $tax_name . '">' . $taxonomy['label'] . '</label>';

					$output .= '<div class="checkbox-wrapper taxonomy-term">
						<input type="checkbox" name="taxonomy[' . $tax_name . ']" id="taxonomy-label-' . $tax_name . '" value="any">
						<label for="tax-' . $tax_name . '">' . $taxonomy['label'] . '</label>
						</div>';

				foreach ( $taxonomy['terms'] as $term ){
					$termtype = 'child';
					if ( $term->parent == 0 ) {
						$termtype = 'parent';
					}
					$output .= '<div class="checkbox-wrapper ' . $termytpe . '">
						<input type="checkbox" name="taxonomy[' . $tax_name . ']" id="' . $term->slug . '" value="' . $term->term_id . '">
						<label for="' . $term->slug . '">' . $term->name . '</label>
						</div>';
				}
				$output .= '</div>';
			endforeach;
		endif;
	endif;
	$output .= '<div class="submit">
		<input type="hidden" name="latitude" class="latitude" />
		<input type="hidden" name="longitude" class="longitude" />
		<input type="hidden" name="unit" value="' . $this->unit_raw . '" class="unit" />
		<input type="hidden" name="limit" class="limit" value="' . $this->options['perpage'] . '" />
		<button type="submit" class="wpslsubmit">' . html_entity_decode($this->options['buttontext']) . '</button>
	</div>
	<div class="geo_button_cont"></div>
	</form>';
if ( $this->options['mapcontainer'] === '.wpsl-map' ){
	$output .= ( isset($mapheight) && $mapheight !== "" )
		? '<div class="wpsl-map" style="height:' . $mapheight . 'px;"></div>'
		: '<div class="wpsl-map"></div>';
}

$output .= '
<div class="wpsl-results loading"></div>
</div><!-- .simple-locator-form -->';

if ( isset($widget_instance) ) $output .= '</div><!-- .simple-locator-widget -->';
